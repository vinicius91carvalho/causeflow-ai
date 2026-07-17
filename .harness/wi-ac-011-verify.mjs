#!/usr/bin/env node
/**
 * WI-AC-011 / AC-011 HTTP boundary probe (core OSS product path).
 *
 * Asserts commercial billing checkout/portal/credits/plan-catalog surfaces are
 * removed (404, not a permanent 410 facade) and that creating an investigation
 * is not blocked by CREDITS_EXHAUSTED / free-tier quota.
 *
 * Usage: PORT=5171 node .harness/wi-ac-011-verify.mjs
 */
const PORT = process.env.PORT || '5171';
const BASE = `http://127.0.0.1:${PORT}`;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('PASS:', msg);
  }
}

async function main() {
  const health = await fetch(`${BASE}/health`);
  assert(health.status === 200 || health.status === 503, `/health -> ${health.status}`);

  const email = `ac011-${Date.now()}@causeflow.local`;
  const reg = await fetch(`${BASE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'testpass123',
      tenantName: `AC011 ${Date.now()}`,
      name: 'AC011 Admin',
    }),
  });
  const regBody = await reg.json();
  assert(reg.status === 201 && typeof regBody.token === 'string', `register -> ${reg.status}`);
  const auth = {
    Authorization: `Bearer ${regBody.token}`,
    'Content-Type': 'application/json',
  };

  const commercialPosts = [
    ['/v1/billing/checkout', { planKey: 'starter', successUrl: 'http://localhost/ok', cancelUrl: 'http://localhost/cancel' }],
    ['/v1/billing/checkout-session', { planKey: 'starter', successUrl: 'http://localhost/ok', cancelUrl: 'http://localhost/cancel' }],
    ['/v1/billing/portal', { returnUrl: 'http://localhost/billing' }],
  ];

  for (const [path, body] of commercialPosts) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    assert(res.status === 404, `${path} removed (got ${res.status}, not 410 facade)`);
    assert(!/billing is disabled/i.test(text), `${path} must not return 410 facade body`);
  }

  const credits = await fetch(`${BASE}/v1/billing/credits`, { headers: auth });
  assert(credits.status === 404, `GET /v1/billing/credits removed (got ${credits.status})`);

  const plans = await fetch(`${BASE}/v1/billing/plans`, { headers: auth });
  assert(plans.status === 404, `GET /v1/billing/plans (plan catalog) removed (got ${plans.status})`);

  const chat = await fetch(`${BASE}/v1/incidents/chat`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      title: 'AC-011 investigation create',
      description: 'Must not be blocked by CREDITS_EXHAUSTED',
      severity: 'high',
    }),
  });
  const chatBody = await chat.json();
  assert(chat.status === 201, `POST /v1/incidents/chat -> ${chat.status}`);
  assert(
    chat.status !== 402 && chatBody?.code !== 'CREDITS_EXHAUSTED' && chatBody?.error !== 'QUOTA_EXCEEDED',
    'investigation create not blocked by CREDITS_EXHAUSTED / free-tier quota',
  );
  assert(typeof chatBody.incidentId === 'string', `incidentId present (${chatBody.incidentId})`);

  console.log('---');
  console.log(process.exitCode ? 'AC-011: SOME ASSERTIONS FAILED' : 'AC-011: ALL ASSERTIONS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
