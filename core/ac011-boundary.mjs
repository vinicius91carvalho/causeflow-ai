// AC-011 boundary: real HTTP against running app on PORT=5183.
// - Mints a real Clerk session JWT (RS256) signed with a local 2048-bit RSA key;
//   the app verifies it networklessly via @clerk/backend verifyToken({ jwtKey }).
// - Creates a tenant via POST /v1/tenants (admin role from JWT).
// - POST /v1/billing/checkout with a valid planKey → expects a Stripe checkout URL.
// - Generates a real Stripe webhook signature (HMAC-SHA256, v1 scheme — the exact
//   format the Stripe CLI produces) over a checkout.session.completed event using
//   the shared webhook secret, POSTs it to /v1/billing/webhook. The app's
//   stripe.webhooks.constructEvent performs genuine signature verification.
// - Confirms the webhook created a BillingAccountEntity via GET /v1/billing/usage.
import { importPKCS8, SignJWT } from 'jose';
import Stripe from 'stripe';
import { readFileSync } from 'node:fs';

const PORT = process.env.PORT || '5183';
const BASE = `http://localhost:${PORT}`;
const PRIV = readFileSync('/tmp/ac011-clerk-priv.pem', 'utf8');
const WEBHOOK_SECRET = 'whsec_ac011_boundary_secret';
const ORG_ID = `org_ac011_${Date.now()}`;
const USER_ID = 'user_ac011_boundary';
const EMAIL = 'admin-ac011@causeflow.ai';

const key = await importPKCS8(PRIV, 'RS256');
const now = Math.floor(Date.now() / 1000);
const jwt = await new SignJWT({
  sub: USER_ID,
  email: EMAIL,
  iss: 'https://clerk.causeflow.local',
  azp: 'causeflow-local',
  iat: now,
  nbf: now - 60,
  exp: now + 3600,
  // Clerk v2 compact org claim
  o: { id: ORG_ID, rol: 'admin', slg: 'ac011' },
}).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).sign(key);

const auth = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('PASS:', msg);
}

// 1) Create tenant (provisioning: requires valid JWT + admin role; uses JWT org id as tenantId)
let r = await fetch(`${BASE}/v1/tenants`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({ name: 'AC-011 Boundary', slug: `ac011-boundary-${Date.now()}`, ownerEmail: EMAIL, plan: 'starter' }),
});
console.log('POST /v1/tenants ->', r.status);
const tenant = await r.json();
console.log('  tenant.tenantId =', tenant.tenantId);
assert(r.status === 201, 'tenant created (201)');
assert(tenant.tenantId === ORG_ID, `tenantId = JWT org id (${ORG_ID})`);

// 2) POST /v1/billing/checkout with a valid planKey → Stripe checkout URL
r = await fetch(`${BASE}/v1/billing/checkout`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    planKey: 'starter',
    successUrl: 'https://app.causeflow.local/billing/success',
    cancelUrl: 'https://app.causeflow.local/billing/cancel',
  }),
});
console.log('POST /v1/billing/checkout ->', r.status);
const checkout = await r.json();
console.log('  checkout =', JSON.stringify(checkout));
assert(r.status === 200, 'checkout-session returns 200');
assert(typeof checkout.url === 'string' && checkout.url.startsWith('https://checkout.stripe.com/'),
  `returns a Stripe checkout URL (${checkout.url?.slice(0, 40)}…)`);

// 3) Stripe webhook: checkout.session.completed, signed with the shared secret.
//    Same signature algorithm/format the Stripe CLI uses; constructEvent verifies it.
const stripe = new Stripe('sk_test_ac011boundary', {
  apiVersion: '2026-02-25.clover', host: 'localhost', port: 12111, protocol: 'http',
});
const eventPayload = {
  id: 'evt_ac011_boundary',
  object: 'event',
  api_version: '2026-02-25.clover',
  created: now,
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_ac011_boundary',
      object: 'checkout.session',
      mode: 'subscription',
      customer: 'cus_test_ac011_boundary',
      subscription: 'sub_test_ac011', // stripe-mock fixture responds to subscriptions.retrieve
      metadata: { tenantId: ORG_ID },
    },
  },
};
const rawBody = JSON.stringify(eventPayload);
const signature = stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret: WEBHOOK_SECRET });

r = await fetch(`${BASE}/v1/billing/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
  body: rawBody,
});
console.log('POST /v1/billing/webhook (checkout.session.completed) ->', r.status);
const wh = await r.json();
console.log('  webhook resp =', JSON.stringify(wh));
assert(r.status === 200, 'webhook returns 200 (signature verified)');

// 4) Confirm BillingAccountEntity was created for the user/tenant
r = await fetch(`${BASE}/v1/billing/usage`, { headers: auth });
console.log('GET /v1/billing/usage ->', r.status);
const usage = await r.json();
console.log('  usage.account =', JSON.stringify(usage.account));
assert(r.status === 200, 'usage returns 200');
assert(usage.account !== null && usage.account.tenantId === ORG_ID,
  `BillingAccountEntity created for tenant ${ORG_ID}`);
assert(usage.account.investigationsLimit > 0, `BillingAccount has plan quotas (invLimit=${usage.account?.investigationsLimit})`);

// 5) Negative: invalid signature → 400 (defensive, AC-013 territory but confirms verification is real)
r = await fetch(`${BASE}/v1/billing/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
  body: rawBody,
});
console.log('POST /v1/billing/webhook (bad signature) ->', r.status);
assert(r.status === 400, 'invalid signature rejected (400)');

console.log('---');
console.log(process.exitCode ? 'AC-011: SOME ASSERTIONS FAILED' : 'AC-011: ALL ASSERTIONS PASSED');
