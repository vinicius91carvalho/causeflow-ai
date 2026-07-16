import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5170';
const CORE = 'http://127.0.0.1:3099';
const email = `iv-ac074-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const out = { base: BASE, email, steps: [] };

async function req(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const reg = await req(`${CORE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password: pass,
    tenantName: 'AC074 IV Tenant',
    name: 'AC074 Admin',
  }),
});
out.steps.push({ step: 'register', status: reg.status, body: reg.body });
const token = reg.body?.token;
if (!token) throw new Error('no token from register');
const cookie = `__session=${token}`;

const metrics = await req(`${BASE}/api/metrics`, { headers: { Cookie: cookie } });
out.steps.push({ step: 'metrics', status: metrics.status, body: metrics.body });

const subscription = await req(`${BASE}/api/billing/subscription`, {
  headers: { Cookie: cookie },
});
out.steps.push({ step: 'subscription', status: subscription.status, body: subscription.body });

const creates = [];
for (let attempt = 1; attempt <= 5; attempt++) {
  const create = await req(`${BASE}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: `AC074 IV incident ${attempt}`,
      description: `Integration verification incident attempt ${attempt} for credits gate removal.`,
      severity: 'medium',
    }),
  });
  creates.push({ attempt, status: create.status, body: create.body });
}
out.steps.push({ step: 'create_incidents', creates });

const metricsAfter = await req(`${BASE}/api/metrics`, { headers: { Cookie: cookie } });
out.steps.push({ step: 'metrics_after', status: metricsAfter.status, body: metricsAfter.body });

const metricsBody = metrics.body?.metrics ?? {};
const subBody = subscription.body ?? {};
const any402 = creates.some((c) => c.status === 402);
const allCreateSuccess = creates.every((c) => c.status === 201);
const metricsShowCreditLimits =
  'creditsRemaining' in metricsBody ||
  'creditsTotal' in metricsBody ||
  'creditsUsed' in metricsBody;
const subscriptionHasQuotaFields =
  'creditsRemaining' in subBody || 'creditsTotal' in subBody || 'creditsUsed' in subBody;

out.eval = {
  any_402: any402,
  all_create_success: allCreateSuccess,
  metrics_show_credit_limits: metricsShowCreditLimits,
  subscription_has_quota_fields: subscriptionHasQuotaFields,
};

fs.writeFileSync('.harness/wi-ac-074-iv-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.eval, null, 2));
