// AC-013 boundary: real HTTP against an app booted in-process (deterministic
// LLM/agent stubs — no paid Anthropic calls; AC-013 does not run an
// investigation, the stubs only satisfy the bootstrap composition root).
//
// AC-013: Stripe webhook with an invalid signature (mutated body) returns 400;
// valid signature returns 200. After `customer.subscription.deleted` arrives,
// the tenant's plan drops to "free" and gated endpoints return 402.
//
// Flow:
//  1. Mint a real Clerk session JWT (RS256) signed with the local keypair at
//     /tmp/ac011-clerk-priv.pem; the app verifies it networklessly.
//  2. POST /v1/tenants -> tenant (admin, tenantId = JWT org id).
//  3. Provision a BillingAccountEntity at the starter plan (15 investigations)
//     directly via the repo (setup only — establishes the pre-deletion quota).
//  4. GET /v1/billing/subscription + GET /v1/billing/usage -> starter plan / 15.
//  5. POST /v1/billing/webhook with an INVALID signature (mutated body) -> 400.
//  6. POST /v1/billing/webhook with a VALID signature (customer.subscription.deleted)
//     -> 200 (signature genuinely verified by stripe.webhooks.constructEvent).
//  7. GET /v1/billing/subscription -> plan = "free".
//  8. GET /v1/billing/usage -> investigationsLimit === 0 (dropped to free).
//  9. POST /v1/incidents/chat (gated endpoint) -> 402 (plan dropped to free).
import { readFileSync } from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';
import { serve } from '@hono/node-server';
import Stripe from 'stripe';

// --- Env must be set BEFORE config/bootstrap is imported (config reads env at
//     module load). ---
process.env['PORT'] = process.env['PORT'] || '5181';
process.env['NODE_ENV'] = 'development';
process.env['AWS_REGION'] = 'sa-east-1';
process.env['AWS_ACCESS_KEY_ID'] = 'test';
process.env['AWS_SECRET_ACCESS_KEY'] = 'test';
process.env['DYNAMODB_ENDPOINT'] = 'http://localhost:4566';
process.env['DYNAMODB_TABLE_NAME'] = 'causeflow-local';
process.env['REDIS_URL'] = 'redis://172.18.0.4:6379';
process.env['ANTHROPIC_API_KEY'] = 'stub-boundary-ac013';
process.env['HINDSIGHT_API_URL'] = '';
process.env['STRIPE_SECRET_KEY'] = 'sk_test_ac013boundary';
process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_ac013_boundary_secret';
process.env['STRIPE_HOST'] = 'localhost';
process.env['STRIPE_PORT'] = '12111';
process.env['STRIPE_PROTOCOL'] = 'http';
process.env['STRIPE_STARTER_PRICE_ID'] = 'price_1PgafmB7WZ01zgkW6dKueIc5';
process.env['CLERK_JWT_KEY'] = readFileSync('/tmp/ac011-clerk-pub.pem', 'utf8');
process.env['LOG_LEVEL'] = 'warn';

const { bootstrap } = await import('./src/bootstrap.js');
const { createApp } = await import('./src/app.js');
const { DeterministicLLMClient } = await import('./tests/e2e/stubs/deterministic-llm-client.js');
const { DeterministicAgentRunner } = await import('./tests/e2e/stubs/deterministic-agent-runner.js');
const { DynamoBillingAccountRepository } = await import('./src/modules/billing/infra/dynamo-billing-account.repository.js');

const PORT = Number(process.env['PORT']);
const BASE = `http://localhost:${PORT}`;
const PRIV = readFileSync('/tmp/ac011-clerk-priv.pem', 'utf8');
const WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET']!;

// Stripe SDK pointed at stripe-mock — used only for generateTestHeaderString
// (pure local HMAC-SHA256, the exact v1 signature format the Stripe CLI emits).
const stripe = new Stripe('sk_test_ac013boundary', {
  apiVersion: '2026-02-25.clover', host: 'localhost', port: 12111, protocol: 'http',
});

let exitCode = 0;
let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log('PASS:', msg); }
  else { failed++; console.error('FAIL:', msg); exitCode = 1; }
}

// --- Boot the app with deterministic LLM/agent stubs ---
const stubLLM = new DeterministicLLMClient();
const stubAgent = new DeterministicAgentRunner();
console.log('[boot] bootstrapping CauseFlow with deterministic LLM/agent stubs...');
const ctx = await bootstrap({ llmClient: stubLLM, agentRunner: stubAgent });
const app = createApp(ctx);
const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[boot] CauseFlow listening on ${PORT}`);
});
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(`${BASE}/health`); if (r.ok) { console.log('[boot] /health ok'); break; } } catch { /* retry */ }
  await new Promise((r) => setTimeout(r, 500));
}

async function mintJwt(orgId: string, role = 'admin') {
  const key = await importPKCS8(PRIV, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: `user_${orgId}`,
    email: `admin-${orgId}@causeflow.ai`,
    iss: 'https://clerk.causeflow.local',
    azp: 'causeflow-local',
    iat: now, nbf: now - 60, exp: now + 3600,
    o: { id: orgId, rol: role, slg: orgId.slice(-8) },
  }).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).sign(key);
}

const TS = Date.now();
const ORG_ID = `org_ac013_${TS}`;
const SUBSCRIPTION_ID = `sub_ac013_${TS}`;
const jwt = await mintJwt(ORG_ID);
const auth = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

// 1) Create tenant (tenantId = JWT org id, cryptographically verified)
let r = await fetch(`${BASE}/v1/tenants`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({ name: 'AC-013 Boundary', slug: `ac013-boundary-${TS}`, ownerEmail: `admin-${ORG_ID}@causeflow.ai`, plan: 'starter' }),
});
console.log('POST /v1/tenants ->', r.status);
const tenant = await r.json();
console.log('  tenant.tenantId =', tenant.tenantId);
assert(r.status === 201, 'tenant created (201)');
assert(tenant.tenantId === ORG_ID, `tenantId = JWT org id (${ORG_ID})`);

// 2) Provision a BillingAccountEntity at the starter plan (setup only)
const billingRepo = new DynamoBillingAccountRepository();
await billingRepo.create({
  tenantId: ORG_ID as any,
  investigationsLimit: 15,
  investigationsUsed: 0,
  eventsLimit: 500,
  eventsUsed: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
console.log('[setup] BillingAccountEntity created for tenant at starter quotas (15/500)');

// 3) Pre-deletion state: starter plan + 15 investigations
r = await fetch(`${BASE}/v1/billing/subscription`, { headers: auth });
console.log('GET /v1/billing/subscription (pre-delete) ->', r.status);
let sub = await r.json();
console.log('  subscription =', JSON.stringify(sub));
assert(r.status === 200, 'subscription returns 200 (pre-delete)');
assert(sub.plan === 'starter', `plan is starter before deletion (got ${sub.plan})`);
assert(sub.investigationsLimit === 15, `starter investigationsLimit=15 (got ${sub.investigationsLimit})`);

r = await fetch(`${BASE}/v1/billing/usage`, { headers: auth });
console.log('GET /v1/billing/usage (pre-delete) ->', r.status);
let usage = await r.json();
console.log('  usage.account =', JSON.stringify(usage.account));
assert(r.status === 200, 'usage returns 200 (pre-delete)');
assert(usage.account?.investigationsLimit === 15, `BillingAccount at starter quotas (invLimit=15, got ${usage.account?.investigationsLimit})`);

// 4) Build the customer.subscription.deleted event payload
const now = Math.floor(Date.now() / 1000);
const deletedEvent = {
  id: `evt_ac013_del_${TS}`,
  object: 'event',
  api_version: '2026-02-25.clover',
  created: now,
  type: 'customer.subscription.deleted',
  data: {
    object: {
      id: SUBSCRIPTION_ID,
      object: 'subscription',
      status: 'canceled',
      cancel_at_period_end: false,
      metadata: { tenantId: ORG_ID },
      items: { data: [{ price: { id: 'price_1PgafmB7WZ01zgkW6dKueIc5' } }] },
    },
  },
};
const rawBody = JSON.stringify(deletedEvent);
const signature = stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret: WEBHOOK_SECRET });

// 5) AC-013: invalid signature (mutated body) -> 400
//    Mutate the body AFTER signing so the HMAC no longer matches the payload.
const mutatedBody = rawBody.replace('"customer.subscription.deleted"', '"customer.subscription.updated"');
r = await fetch(`${BASE}/v1/billing/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
  body: mutatedBody,
});
console.log('POST /v1/billing/webhook (mutated body, invalid sig) ->', r.status);
assert(r.status === 400, 'invalid signature (mutated body) rejected with 400');

// 6) AC-013: valid signature -> 200 (customer.subscription.deleted)
r = await fetch(`${BASE}/v1/billing/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
  body: rawBody,
});
console.log('POST /v1/billing/webhook (customer.subscription.deleted, valid sig) ->', r.status);
const wh = await r.json();
console.log('  webhook resp =', JSON.stringify(wh));
assert(r.status === 200, 'customer.subscription.deleted webhook returns 200 (signature verified)');

// 7) AC-013: tenant plan drops to "free"
r = await fetch(`${BASE}/v1/billing/subscription`, { headers: auth });
console.log('GET /v1/billing/subscription (post-delete) ->', r.status);
sub = await r.json();
console.log('  subscription =', JSON.stringify(sub));
assert(r.status === 200, 'subscription returns 200 (post-delete)');
assert(sub.plan === 'free', `plan dropped to "free" after subscription.deleted (got ${sub.plan})`);

// 8) BillingAccount quotas dropped to 0
r = await fetch(`${BASE}/v1/billing/usage`, { headers: auth });
console.log('GET /v1/billing/usage (post-delete) ->', r.status);
usage = await r.json();
console.log('  usage.account =', JSON.stringify(usage.account));
assert(r.status === 200, 'usage returns 200 (post-delete)');
assert(usage.account?.investigationsLimit === 0, `BillingAccount investigationsLimit dropped to 0 (got ${usage.account?.investigationsLimit})`);
assert(usage.account?.eventsLimit === 0, `BillingAccount eventsLimit dropped to 0 (got ${usage.account?.eventsLimit})`);

// 9) AC-013: gated endpoint returns 402 after plan drops to free
r = await fetch(`${BASE}/v1/incidents/chat`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    title: 'AC-013 gated endpoint probe',
    description: 'Verifies that gated endpoints return 402 after the plan drops to free.',
    severity: 'critical',
    suggestedAgents: ['log_analyst'],
  }),
});
console.log('POST /v1/incidents/chat (gated, post-delete) ->', r.status);
const gated = await r.json().catch(() => ({} as any));
console.log('  gated resp =', JSON.stringify(gated));
assert(r.status === 402, `gated endpoint returns 402 after plan drops to free (got ${r.status})`);

console.log('---');
console.log(`AC-013: ${passed} passed, ${failed} failed`);
console.log(exitCode ? 'AC-013: SOME ASSERTIONS FAILED' : 'AC-013: ALL ASSERTIONS PASSED');

server.close();
for (const c of ctx.consumers) { try { await c.stop(); } catch { /* noop */ } }
process.exit(exitCode);
