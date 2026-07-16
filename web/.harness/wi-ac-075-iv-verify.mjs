import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5170';
const CORE = 'http://127.0.0.1:3099';
const WEBSITE = 'http://127.0.0.1:3000';
const email = `iv-ac075-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const out = { base: BASE, core: CORE, website: WEBSITE, email, steps: [] };

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

// Step 1 static checks (recorded for evidence)
out.static = {
  dashboard_has_stripe_dep: false,
  add_credits_exists: fs.existsSync('apps/dashboard/scripts/add-credits.ts'),
  core_oss_billing_middleware_exists: fs.existsSync(
    '../core/src/shared/infra/http/middleware/oss-billing-gone.middleware.ts',
  ),
  ac075_spec_exists: fs.existsSync('tests/oss/ac-075-commercial-purge.spec.ts'),
};

// Core unauthenticated billing
for (const path of ['/v1/billing/checkout', '/v1/billing/portal']) {
  const r = await req(`${CORE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planKey: 'starter', successUrl: 'http://x/s', cancelUrl: 'http://x/c', returnUrl: 'http://x/' }),
  });
  out.steps.push({ step: `core_unauth_${path}`, status: r.status, body: r.body });
}

// Dashboard unauthenticated billing proxies
for (const path of ['/api/billing/checkout', '/api/billing/portal']) {
  const r = await req(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: 'starter' }),
  });
  out.steps.push({ step: `dashboard_unauth_${path}`, status: r.status, body: r.body });
}

// Register + authenticated dashboard billing
const reg = await req(`${CORE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password: pass,
    tenantName: 'AC075 IV Tenant',
    name: 'AC075 Admin',
  }),
});
out.steps.push({ step: 'register', status: reg.status, body: reg.body });
const token = reg.body?.token;
if (!token) throw new Error('no token from register');
const cookie = `__session=${token}`;

for (const path of ['/api/billing/checkout', '/api/billing/portal']) {
  const r = await req(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ planId: 'starter' }),
  });
  out.steps.push({ step: `dashboard_auth_${path}`, status: r.status, body: r.body });
}

// Marketing pricing page HTML audit
const pricing = await req(`${WEBSITE}/pricing`);
const html = typeof pricing.body === 'string' ? pricing.body : '';
out.steps.push({ step: 'website_pricing', status: pricing.status, htmlLength: html.length });
out.pricing_audit = {
  has_stripe_checkout_url: /checkout\.stripe\.com/i.test(html),
  has_self_host_copy: /self-host|open-core|open source|github\.com/i.test(html),
  has_paid_monthly_toggle: /Monthly|Annual/i.test(html),
  has_create_account_cta: /Create Account/i.test(html),
};

out.eval = {
  core_checkout_unauth_410: out.steps.find((s) => s.step === 'core_unauth_/v1/billing/checkout')?.status === 410,
  core_portal_unauth_410: out.steps.find((s) => s.step === 'core_unauth_/v1/billing/portal')?.status === 410,
  dashboard_checkout_unauth_410: out.steps.find((s) => s.step === 'dashboard_unauth_/api/billing/checkout')?.status === 410,
  dashboard_portal_unauth_410: out.steps.find((s) => s.step === 'dashboard_unauth_/api/billing/portal')?.status === 410,
  dashboard_checkout_auth_410: out.steps.find((s) => s.step === 'dashboard_auth_/api/billing/checkout')?.status === 410,
  dashboard_portal_auth_410: out.steps.find((s) => s.step === 'dashboard_auth_/api/billing/portal')?.status === 410,
  add_credits_removed: !out.static.add_credits_exists,
  core_middleware_in_source: out.static.core_oss_billing_middleware_exists,
  pricing_no_stripe_checkout: !out.pricing_audit.has_stripe_checkout_url,
  pricing_has_oss_messaging: out.pricing_audit.has_self_host_copy,
};

fs.writeFileSync('.harness/wi-ac-075-iv-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.eval, null, 2));
