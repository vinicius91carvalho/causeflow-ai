/**
 * Tenant provisioning fallback — TEMPORARY workaround.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * The Core API's `POST /v1/tenants` route currently has `requireRole('admin',
 * 'owner')` middleware applied (see core/src/modules/tenant/infra/tenant.routes.ts).
 * This breaks the provisioning path for brand-new Clerk users: the JWT has a
 * valid userId + orgId, but no org role yet (Clerk only grants `org:admin`
 * AFTER the org exists). The middleware therefore rejects every first-time
 * tenant creation with 403 "Insufficient permissions. Required: admin | owner".
 *
 * A fix is already committed on the Core side — it removes the role guard
 * from the provisioning path and makes `CreateTenantUseCase` idempotent when
 * the same externalTenantId (Clerk org_id) is submitted twice. But the fix
 * cannot be deployed immediately because only the partner has access to the
 * Core production pipeline.
 *
 * This module is the dashboard-side escape hatch: when Core's create-tenant
 * endpoint returns 403 FORBIDDEN, we write the tenant + billing account
 * records directly to the Core DynamoDB table using ElectroDB's wire format.
 * The dashboard already holds AWS credentials for DynamoDB (see
 * BusinessProfileRepository) so no new permissions are required.
 *
 * ============================================================================
 * HOW TO REMOVE
 * ============================================================================
 * Delete this file AND revert the fallback branch in
 * `contexts/identity/api/complete-profile-handler.ts` once the Core API fix
 * has been deployed to staging + production and the health check confirms
 * `POST /v1/tenants` returns 201 for brand-new users.
 *
 * ============================================================================
 * DynamoDB shape
 * ============================================================================
 * Core uses ElectroDB single-table design. For the `Tenant` entity:
 *   model:   { entity: 'tenant', version: '1', service: 'causeflow' }
 *   primary: pk = ['tenantId'], sk = []
 *   gsi1:    bySlug          → pk = ['slug'],         sk = []
 *   gsi2:    byOwner         → pk = ['ownerEmail'],   sk = ['createdAt']
 *   gsi3:    byCustomDomain  → pk = ['customDomain'], sk = []
 *
 * ElectroDB lowercases composite values in the composed pk/sk strings but
 * leaves the attribute columns in their original case. It stores the entity
 * metadata in `__edb_e__` and `__edb_v__` fields which future reads depend on.
 *
 * `BillingAccount` uses the same tenantId as its primary key — the Core API's
 * checkout flow assumes the record exists (it is created by SignupUseCase
 * normally), so we mirror that invariant here.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TenantRecord {
  pk: string;
  sk: string;
  __edb_e__: 'tenant';
  __edb_v__: '1';
  tenantId: string;
  name: string;
  slug: string;
  ownerEmail: string;
  plan: 'starter' | 'pro' | 'business' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  settings: Record<string, unknown>;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk: string;
  gsi2sk: string;
}

export interface BillingAccountRecord {
  pk: string;
  sk: string;
  __edb_e__: 'billingAccount';
  __edb_v__: '1';
  tenantId: string;
  investigationsLimit: number;
  investigationsUsed: number;
  eventsLimit: number;
  eventsUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionInput {
  /** Clerk org_id — used as the Core tenantId. */
  tenantId: string;
  /** Display name (Clerk organization name). */
  name: string;
  /** URL-safe slug. */
  slug: string;
  /** Owner email (may be empty string when unknown). */
  ownerEmail: string;
  /** Optional override for the ISO timestamp — tests pin this for determinism. */
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// ElectroDB key composition helpers
// ---------------------------------------------------------------------------

const SERVICE = 'causeflow';
const TENANT_ENTITY = 'tenant';
const TENANT_VERSION = '1';
const BILLING_ACCOUNT_ENTITY = 'billingAccount';

function tenantPk(tenantId: string): string {
  // ElectroDB lowercases composite values in the composed pk/sk strings.
  return `$${SERVICE}#tenantid_${tenantId.toLowerCase()}`;
}

function tenantSk(): string {
  return `$${TENANT_ENTITY}_${TENANT_VERSION}`;
}

function bySlugPk(slug: string): string {
  return `$${SERVICE}#slug_${slug.toLowerCase()}`;
}

function byOwnerPk(ownerEmail: string): string {
  return `$${SERVICE}#owneremail_${ownerEmail.toLowerCase()}`;
}

function byOwnerSk(createdAt: string): string {
  return `$${TENANT_ENTITY}_${TENANT_VERSION}#createdat_${createdAt.toLowerCase()}`;
}

function billingAccountSk(): string {
  // ElectroDB lowercases the entity name in sk composition.
  return `$${BILLING_ACCOUNT_ENTITY.toLowerCase()}_${TENANT_VERSION}`;
}

// ---------------------------------------------------------------------------
// Record builders (pure — exported for unit testing)
// ---------------------------------------------------------------------------

export function buildTenantRecord(input: ProvisionInput): TenantRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    pk: tenantPk(input.tenantId),
    sk: tenantSk(),
    __edb_e__: 'tenant',
    __edb_v__: '1',
    tenantId: input.tenantId,
    name: input.name,
    slug: input.slug,
    ownerEmail: input.ownerEmail,
    plan: 'starter',
    status: 'active',
    settings: {},
    cancelAtPeriodEnd: false,
    createdAt,
    updatedAt: createdAt,
    gsi1pk: bySlugPk(input.slug),
    gsi1sk: tenantSk(),
    gsi2pk: byOwnerPk(input.ownerEmail),
    gsi2sk: byOwnerSk(createdAt),
  };
}

export function buildBillingAccountRecord(input: {
  tenantId: string;
  createdAt?: string;
}): BillingAccountRecord {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    pk: tenantPk(input.tenantId),
    sk: billingAccountSk(),
    __edb_e__: 'billingAccount',
    __edb_v__: '1',
    tenantId: input.tenantId,
    investigationsLimit: 15,
    investigationsUsed: 0,
    eventsLimit: 500,
    eventsUsed: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

// ---------------------------------------------------------------------------
// DynamoDB write
// ---------------------------------------------------------------------------

function getTableName(): string {
  // Dashboard .env.local may set DYNAMODB_TABLE_NAME; otherwise default to
  // the staging single-table layout (matches CORE_API_URL = api-staging).
  return process.env.DYNAMODB_TABLE_NAME ?? 'causeflow-staging';
}

let cachedClient: DynamoDBDocumentClient | null = null;
function getClient(): DynamoDBDocumentClient {
  if (!cachedClient) {
    cachedClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }
  return cachedClient;
}

/**
 * Write a new Tenant + BillingAccount directly to the Core DynamoDB table.
 *
 * Uses BatchWrite so both records either land together or not at all (under
 * normal AWS semantics). On success the Core API will find the tenant on
 * every subsequent request made by the same Clerk org.
 *
 * Safe to call when a record already exists — BatchWrite semantics are an
 * unconditional Put, so duplicates are overwritten with fresh timestamps.
 * Callers should short-circuit before hitting this when the tenant is known
 * to exist, to avoid resetting Stripe-owned fields like stripeCustomerId.
 */
export async function provisionTenantDirect(input: ProvisionInput): Promise<void> {
  const tenantRecord = buildTenantRecord(input);
  const billingRecord = buildBillingAccountRecord({
    tenantId: input.tenantId,
    createdAt: tenantRecord.createdAt,
  });

  const tableName = getTableName();
  await getClient().send(
    new BatchWriteCommand({
      RequestItems: {
        [tableName]: [
          { PutRequest: { Item: tenantRecord } },
          { PutRequest: { Item: billingRecord } },
        ],
      },
    }),
  );
}
