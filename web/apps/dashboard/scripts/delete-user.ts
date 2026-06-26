#!/usr/bin/env tsx

/**
 * delete-user.ts — Complete platform purge of a user.
 *
 * Removes a user from every CauseFlow system in a single pass:
 *
 *   1. Clerk                 — user account + organization(s) they belong to
 *                              (deleting the org cascades memberships in Clerk)
 *   2. Stripe                — customer(s) matching the email
 *                              (Stripe cancels any active subscriptions as part of
 *                              customer deletion)
 *   3. Core API DynamoDB     — every single-table item scoped to their tenantId
 *                              (every Core entity has a `tenantId` attribute; one
 *                              filter-scan covers User/Tenant/Incident/Remediation/
 *                              Pattern/Audit/Integration/BillingAccount/UsageRecord/
 *                              OAuthToken/GitHubInstallation/ApiKey/... — see
 *                              `causeflow/core/docs/product/05-data-model.md`)
 *
 * The Core API has no tenant-delete endpoint and the dashboard has no admin route,
 * so this script talks directly to the three systems using their secret keys.
 *
 * Required env vars (sourced from apps/dashboard/.env.local and causeflow/core/.env.local
 * when present, falling back to process.env):
 *
 *   CLERK_SECRET_KEY       Clerk secret key — must match the stage you are purging
 *   STRIPE_SECRET_KEY      Stripe secret key — must match the stage you are purging
 *   AWS_REGION             e.g. "us-east-2"
 *   DYNAMODB_TABLE_NAME    optional; defaults to `causeflow-<stage>`
 *
 * AWS credentials are picked up from the default provider chain (env,
 * ~/.aws/credentials, AWS_PROFILE, or an assumed role).
 *
 * Usage:
 *
 *   # Dry run — lookups only, prints what would be deleted
 *   pnpm --filter dashboard run users:delete -- \
 *     --email teste-5@causeflow.ai,test-4@causeflow.ai --stage staging
 *
 *   # Real deletion
 *   pnpm --filter dashboard run users:delete -- \
 *     --email teste-5@causeflow.ai,test-4@causeflow.ai --stage staging --yes
 *
 * Safety: defaults to a dry run. Refuses production unless you pass both
 * `--stage production` and `--yes` AND set env var ALLOW_PRODUCTION=1.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { config as loadEnv } from 'dotenv';
import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Env loading — dashboard .env.local for Clerk, core .env.local for Stripe
// ---------------------------------------------------------------------------

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
loadEnv({ path: resolve(scriptDir, '..', '.env.local') });
// scripts/ → dashboard/ → apps/ → web/ → causeflow/ → core/.env.local
loadEnv({
  path: resolve(scriptDir, '..', '..', '..', '..', 'core', '.env.local'),
  override: false,
});

// core/.env.local is tuned for LocalStack. Strip the LocalStack-specific
// overrides that would otherwise break real AWS calls for this script.
if (process.env.DYNAMODB_ENDPOINT?.includes('localhost')) {
  delete process.env.DYNAMODB_ENDPOINT;
}
if (process.env.SQS_ENDPOINT?.includes('localhost')) {
  delete process.env.SQS_ENDPOINT;
}
if (process.env.AWS_ACCESS_KEY_ID === 'test') {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
}
// Never honor DYNAMODB_TABLE_NAME from env — it conflicts with the --stage
// default. Use --table on the CLI if a non-default table is needed.
delete process.env.DYNAMODB_TABLE_NAME;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  emails: string[];
  stage: string;
  tableName?: string;
  yes: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let emails: string[] = [];
  let stage = '';
  let tableName: string | undefined;
  let yes = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' || a === '-e') {
      emails = argv[++i]
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (a === '--stage') {
      stage = argv[++i];
    } else if (a === '--table') {
      tableName = argv[++i];
    } else if (a === '--yes' || a === '-y') {
      yes = true;
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: users:delete --email a@b.com[,c@d.com] --stage staging [--yes]`);
      process.exit(0);
    }
  }

  return { emails, stage, tableName, yes };
}

// ---------------------------------------------------------------------------
// Clerk HTTP client — no SDK dep needed, just bearer auth against api.clerk.com
// ---------------------------------------------------------------------------

const CLERK_API = 'https://api.clerk.com/v1';

interface ClerkUser {
  id: string;
  email_addresses: Array<{ email_address: string }>;
}

interface ClerkOrgMembership {
  organization: { id: string; name: string };
}

async function clerkFetch<T>(path: string, init: RequestInit = {}): Promise<T | undefined> {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clerk ${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined;
  return (await res.json()) as T;
}

async function clerkFindUsersByEmail(email: string): Promise<ClerkUser[]> {
  // Clerk's /v1/users supports `email_address` query param for exact match.
  // Multiple values can be passed; we only send one.
  const url = `/users?email_address=${encodeURIComponent(email)}&limit=100`;
  const result = await clerkFetch<ClerkUser[]>(url);
  return result ?? [];
}

async function clerkListOrgMemberships(userId: string): Promise<ClerkOrgMembership[]> {
  const r = await clerkFetch<{ data: ClerkOrgMembership[] }>(
    `/users/${encodeURIComponent(userId)}/organization_memberships?limit=100`,
  );
  return r?.data ?? [];
}

async function clerkDeleteOrganization(orgId: string): Promise<void> {
  await clerkFetch(`/organizations/${encodeURIComponent(orgId)}`, { method: 'DELETE' });
}

async function clerkDeleteUser(userId: string): Promise<void> {
  await clerkFetch(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// DynamoDB helpers
// ---------------------------------------------------------------------------

function createDdbClient(): DynamoDBDocumentClient {
  const region = process.env.AWS_REGION ?? 'us-east-2';
  const base = new DynamoDBClient({ region });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

async function scanAll<T = Record<string, unknown>>(
  doc: DynamoDBDocumentClient,
  table: string,
  filter: {
    expression: string;
    values: Record<string, unknown>;
    names?: Record<string, string>;
  },
): Promise<T[]> {
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: filter.expression,
        ExpressionAttributeValues: filter.values,
        ExpressionAttributeNames: filter.names,
        ExclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as T[]));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

interface TenantRow {
  tenantId: string;
  ownerEmail?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  pk: string;
  sk: string;
}

async function findTenantsByOwnerEmail(
  doc: DynamoDBDocumentClient,
  table: string,
  email: string,
): Promise<TenantRow[]> {
  // Only the Tenant entity has an `ownerEmail` attribute in the Core single-table.
  // Scanning on it is safe for staging volumes.
  return scanAll<TenantRow>(doc, table, {
    expression: 'ownerEmail = :email',
    values: { ':email': email },
  });
}

interface UserRow {
  tenantId?: string;
  email?: string;
  userId?: string;
  pk: string;
  sk: string;
}

async function findUsersByEmail(
  doc: DynamoDBDocumentClient,
  table: string,
  email: string,
): Promise<UserRow[]> {
  // The User and Invite entities both have an `email` attribute; scanning by
  // email catches User records even when the Tenant record is missing or the
  // user only exists as a pending invite.
  return scanAll<UserRow>(doc, table, {
    expression: 'email = :email',
    values: { ':email': email },
  });
}

interface KeyRow {
  pk: string;
  sk: string;
}

async function findItemsByTenantId(
  doc: DynamoDBDocumentClient,
  table: string,
  tenantId: string,
): Promise<KeyRow[]> {
  // Every ElectroDB entity in the Core table has a top-level `tenantId` attribute,
  // so a single scan-with-filter deletes every record for that tenant regardless
  // of its PK composite shape.
  return scanAll<KeyRow>(doc, table, {
    expression: 'tenantId = :t',
    values: { ':t': tenantId },
  });
}

async function batchDelete(
  doc: DynamoDBDocumentClient,
  table: string,
  keys: KeyRow[],
): Promise<void> {
  for (let i = 0; i < keys.length; i += 25) {
    const batch = keys.slice(i, i + 25);
    let requestItems: Record<
      string,
      Array<{ DeleteRequest: { Key: { pk: string; sk: string } } }>
    > = {
      [table]: batch.map((k) => ({
        DeleteRequest: { Key: { pk: k.pk, sk: k.sk } },
      })),
    };

    let attempts = 0;
    while (Object.keys(requestItems).length > 0 && attempts < 5) {
      const res = await doc.send(new BatchWriteCommand({ RequestItems: requestItems }));
      requestItems = (res.UnprocessedItems ?? {}) as typeof requestItems;
      if (Object.keys(requestItems).length > 0) {
        await new Promise((r) => setTimeout(r, 150 * 2 ** attempts));
      }
      attempts++;
    }

    if (Object.keys(requestItems).length > 0) {
      throw new Error(`BatchDelete left unprocessed items after ${attempts} retries`);
    }
  }
}

// ---------------------------------------------------------------------------
// Stripe helpers
// ---------------------------------------------------------------------------

function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required');
  return new Stripe(key);
}

async function findStripeCustomersByEmail(
  stripe: Stripe,
  email: string,
): Promise<Stripe.Customer[]> {
  const list = await stripe.customers.list({ email, limit: 100 });
  return list.data;
}

async function deleteStripeCustomer(stripe: Stripe, customerId: string): Promise<void> {
  await stripe.customers.del(customerId);
}

// ---------------------------------------------------------------------------
// Per-email purge
// ---------------------------------------------------------------------------

interface EmailResult {
  email: string;
  clerkUserIds: string[];
  clerkOrgIds: string[];
  tenantIds: string[];
  stripeCustomerIds: string[];
  itemsDeleted: number;
  errors: string[];
}

async function purgeEmail(
  email: string,
  stripe: Stripe,
  ddb: DynamoDBDocumentClient,
  tableName: string,
  dryRun: boolean,
): Promise<EmailResult> {
  const result: EmailResult = {
    email,
    clerkUserIds: [],
    clerkOrgIds: [],
    tenantIds: [],
    stripeCustomerIds: [],
    itemsDeleted: 0,
    errors: [],
  };

  console.log(`\n━━━ ${email} ━━━`);

  // 1. Look up Clerk users by email
  let clerkUsers: ClerkUser[] = [];
  try {
    clerkUsers = await clerkFindUsersByEmail(email);
    result.clerkUserIds = clerkUsers.map((u) => u.id);
    console.log(
      `  Clerk users       : ${result.clerkUserIds.length > 0 ? result.clerkUserIds.join(', ') : 'none'}`,
    );
  } catch (err) {
    result.errors.push(`Clerk user lookup: ${(err as Error).message}`);
  }

  // 2. Collect all orgs the user(s) belong to
  const orgIdSet = new Set<string>();
  for (const u of clerkUsers) {
    try {
      const memberships = await clerkListOrgMemberships(u.id);
      for (const m of memberships) orgIdSet.add(m.organization.id);
    } catch (err) {
      result.errors.push(`Clerk memberships for ${u.id}: ${(err as Error).message}`);
    }
  }
  result.clerkOrgIds = [...orgIdSet];
  console.log(
    `  Clerk orgs        : ${result.clerkOrgIds.length > 0 ? result.clerkOrgIds.join(', ') : 'none'}`,
  );

  // 3. Look up DynamoDB tenants owned by this email AND any User/Invite records
  //    matching the email. We pool tenantIds from both sources — a "broken"
  //    account may exist as a User without a Tenant or vice versa.
  let tenants: TenantRow[] = [];
  const tenantIdSet = new Set<string>();
  try {
    tenants = await findTenantsByOwnerEmail(ddb, tableName, email);
    for (const t of tenants) {
      if (t.tenantId) tenantIdSet.add(t.tenantId);
    }
  } catch (err) {
    result.errors.push(`DynamoDB tenant scan: ${(err as Error).message}`);
  }
  try {
    const userRows = await findUsersByEmail(ddb, tableName, email);
    for (const u of userRows) {
      if (u.tenantId) tenantIdSet.add(u.tenantId);
    }
  } catch (err) {
    result.errors.push(`DynamoDB user scan: ${(err as Error).message}`);
  }
  result.tenantIds = [...tenantIdSet];
  console.log(
    `  DynamoDB tenants  : ${result.tenantIds.length > 0 ? result.tenantIds.join(', ') : 'none'}`,
  );

  // Collect stripeCustomerIds recorded on the tenant record
  for (const t of tenants) {
    if (t.stripeCustomerId) {
      result.stripeCustomerIds.push(t.stripeCustomerId);
    }
  }

  // 4. Look up Stripe customers by email (catches orphans not linked in DynamoDB)
  try {
    const customers = await findStripeCustomersByEmail(stripe, email);
    for (const c of customers) {
      if (!result.stripeCustomerIds.includes(c.id)) {
        result.stripeCustomerIds.push(c.id);
      }
    }
    console.log(
      `  Stripe customers  : ${
        result.stripeCustomerIds.length > 0 ? result.stripeCustomerIds.join(', ') : 'none'
      }`,
    );
  } catch (err) {
    result.errors.push(`Stripe lookup: ${(err as Error).message}`);
  }

  if (dryRun) {
    console.log('  (dry run — no deletes performed)');
    if (result.errors.length > 0) {
      console.log(`  ⚠ ${result.errors.length} error(s) during lookup:`);
      for (const e of result.errors) console.log(`    - ${e}`);
    }
    return result;
  }

  // 5. Delete DynamoDB items for each tenantId (covers every entity type)
  for (const tid of result.tenantIds) {
    try {
      const items = await findItemsByTenantId(ddb, tableName, tid);
      const keys: KeyRow[] = items
        .filter((i) => typeof i.pk === 'string' && typeof i.sk === 'string')
        .map((i) => ({ pk: i.pk, sk: i.sk }));
      if (keys.length > 0) {
        await batchDelete(ddb, tableName, keys);
      }
      result.itemsDeleted += keys.length;
      console.log(`  ✓ Deleted ${keys.length} DynamoDB item(s) for tenant ${tid}`);
    } catch (err) {
      result.errors.push(`DynamoDB delete for ${tid}: ${(err as Error).message}`);
    }
  }

  // 6. Also delete the tenant rows themselves (in case ownerEmail matched a row
  // that lacked the tenantId attribute for some reason — belt and suspenders)
  if (tenants.length > 0) {
    const extraKeys: KeyRow[] = tenants
      .filter((t) => typeof t.pk === 'string' && typeof t.sk === 'string')
      .map((t) => ({ pk: t.pk, sk: t.sk }));
    try {
      if (extraKeys.length > 0) {
        await batchDelete(ddb, tableName, extraKeys);
      }
    } catch {
      /* already deleted above — ignore */
    }
  }

  // 7. Delete Stripe customers (this cancels every active subscription on them)
  for (const cid of result.stripeCustomerIds) {
    try {
      await deleteStripeCustomer(stripe, cid);
      console.log(`  ✓ Deleted Stripe customer ${cid}`);
    } catch (err) {
      result.errors.push(`Stripe delete ${cid}: ${(err as Error).message}`);
    }
  }

  // 8. Delete Clerk organizations (cascades org memberships inside Clerk)
  for (const oid of result.clerkOrgIds) {
    try {
      await clerkDeleteOrganization(oid);
      console.log(`  ✓ Deleted Clerk organization ${oid}`);
    } catch (err) {
      result.errors.push(`Clerk org delete ${oid}: ${(err as Error).message}`);
    }
  }

  // 9. Delete Clerk users
  for (const uid of result.clerkUserIds) {
    try {
      await clerkDeleteUser(uid);
      console.log(`  ✓ Deleted Clerk user ${uid}`);
    } catch (err) {
      result.errors.push(`Clerk user delete ${uid}: ${(err as Error).message}`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`  ⚠ ${result.errors.length} error(s):`);
    for (const e of result.errors) console.log(`    - ${e}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { emails, stage, tableName: tableOverride, yes } = parseArgs();

  if (emails.length === 0) {
    console.error('Error: --email <a@b.com[,c@d.com]> is required');
    process.exit(1);
  }
  if (!stage) {
    console.error('Error: --stage <staging|production> is required');
    process.exit(1);
  }

  if (stage === 'production') {
    if (!yes || process.env.ALLOW_PRODUCTION !== '1') {
      console.error('Refusing to run against production. Set ALLOW_PRODUCTION=1 AND pass --yes.');
      process.exit(1);
    }
  }

  const tableName = tableOverride ?? `causeflow-${stage}`;

  if (!process.env.CLERK_SECRET_KEY) {
    console.error('Error: CLERK_SECRET_KEY is required (check apps/dashboard/.env.local)');
    process.exit(1);
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(
      'Error: STRIPE_SECRET_KEY is required (check causeflow/core/.env.local or export it)',
    );
    process.exit(1);
  }

  console.log('CauseFlow platform user purge');
  console.log('═════════════════════════════');
  console.log(`Stage       : ${stage}`);
  console.log(`Table       : ${tableName}`);
  console.log(`Region      : ${process.env.AWS_REGION ?? 'us-east-2'}`);
  console.log(`Emails      : ${emails.join(', ')}`);
  console.log(`Clerk key   : ${process.env.CLERK_SECRET_KEY.slice(0, 12)}...`);
  console.log(`Stripe key  : ${process.env.STRIPE_SECRET_KEY.slice(0, 12)}...`);
  console.log(`Mode        : ${yes ? 'DELETE (destructive)' : 'DRY RUN'}`);

  const stripe = createStripeClient();
  const ddb = createDdbClient();

  const results: EmailResult[] = [];
  for (const email of emails) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await purgeEmail(email, stripe, ddb, tableName, !yes));
  }

  console.log('\n═════════════════════════════');
  console.log('Summary');
  console.log('═════════════════════════════');
  let totalErrors = 0;
  for (const r of results) {
    console.log(`${r.email}:`);
    console.log(`  Clerk users           : ${r.clerkUserIds.length}`);
    console.log(`  Clerk orgs            : ${r.clerkOrgIds.length}`);
    console.log(`  DynamoDB tenants      : ${r.tenantIds.length}`);
    console.log(`  Stripe customers      : ${r.stripeCustomerIds.length}`);
    console.log(`  DynamoDB items deleted: ${r.itemsDeleted}`);
    console.log(`  Errors                : ${r.errors.length}`);
    totalErrors += r.errors.length;
  }
  console.log('');

  if (totalErrors > 0) {
    console.error(`Completed with ${totalErrors} error(s).`);
    process.exit(2);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error('\nFATAL:', err);
    process.exit(1);
  });
}

export { parseArgs, purgeEmail };
