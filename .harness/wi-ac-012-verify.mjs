/**
 * WI-AC-012 / AC-012 HTTP boundary probe (web OSS dashboard).
 *
 * Asserts dashboard billing checkout/portal/credits routes are removed (404)
 * or absent, and investigation create via the dashboard BFF is not blocked by
 * a local credits ledger (no 402 CREDITS_EXHAUSTED).
 *
 * Usage: AC012_BASE_URL=http://127.0.0.1:5170 node .harness/wi-ac-012-verify.mjs
 */
import fs from 'node:fs';

const BASE = process.env.AC012_BASE_URL ?? 'http://127.0.0.1:5170';
const OUT = process.env.AC012_OUT ?? '.harness/wi-ac-012-verify-first.json';
const email = process.env.AC012_EMAIL ?? `vf-ac012-${Date.now()}@causeflow.local`;
const pass = process.env.AC012_PASS ?? 'TestPass123!';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('PASS:', msg);
  }
}

async function main() {
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'AC012 VF Admin', email, password: pass }),
  });
  const regBody = await reg.json();
  assert(reg.status === 200 || reg.status === 201, `register -> ${reg.status}`);
  const setCookie = reg.headers.getSetCookie?.() ?? [];
  let token =
    setCookie.map((c) => c.match(/__session=([^;]+)/)?.[1]).find(Boolean) ||
    reg.headers.get('set-cookie')?.match(/__session=([^;]+)/)?.[1] ||
    regBody?.token;
  assert(typeof token === 'string' && token.length > 0, 'session cookie/token present');
  const auth = {
    Cookie: `__session=${token}`,
    'Content-Type': 'application/json',
  };

  const checkout = await fetch(`${BASE}/api/billing/checkout`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ planId: 'starter', from: 'billing' }),
  });
  assert(checkout.status === 404, `POST /api/billing/checkout removed (got ${checkout.status})`);

  const portal = await fetch(`${BASE}/api/billing/portal`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({}),
  });
  assert(portal.status === 404, `POST /api/billing/portal removed (got ${portal.status})`);

  const creditsGet = await fetch(`${BASE}/api/billing/credits`, { headers: auth });
  assert(creditsGet.status === 404, `GET /api/billing/credits absent (got ${creditsGet.status})`);

  const creditsPost = await fetch(`${BASE}/api/billing/credits`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({}),
  });
  assert(creditsPost.status === 404, `POST /api/billing/credits absent (got ${creditsPost.status})`);

  const createStatuses = [];
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${BASE}/api/incidents`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        title: `AC-012 investigation create ${i} ${Date.now()}`,
        description: 'Must not be blocked by a local credits ledger for AC-012.',
        severity: 'medium',
      }),
    });
    const body = await res.json().catch(() => ({}));
    createStatuses.push(res.status);
    assert(res.status !== 402 && body?.code !== 'CREDITS_EXHAUSTED', `create ${i} not CREDITS_EXHAUSTED`);
    assert(res.status === 201, `POST /api/incidents -> ${res.status}`);
  }

  const out = {
    id: 'WI-AC-012',
    phase: process.env.AC012_PHASE ?? 'verify-first',
    base: BASE,
    email,
    routes: {
      'POST /api/billing/checkout': checkout.status,
      'POST /api/billing/portal': portal.status,
      'GET /api/billing/credits': creditsGet.status,
      'POST /api/billing/credits': creditsPost.status,
    },
    create_statuses: createStatuses,
    ac012_pass: !process.exitCode,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log('---');
  console.log(process.exitCode ? 'AC-012: SOME ASSERTIONS FAILED' : 'AC-012: ALL ASSERTIONS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
