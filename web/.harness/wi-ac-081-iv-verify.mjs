import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5170';
const CORE = 'http://127.0.0.1:3099';
const email = `iv-ac081-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const out = { base: BASE, core: CORE, email, steps: [] };

async function req(url, opts = {}) {
  const res = await fetch(url, { redirect: 'manual', ...opts });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  const location = res.headers.get('location');
  return { status: res.status, location, body, headers: Object.fromEntries(res.headers.entries()) };
}

async function followRedirects(startUrl, cookie, max = 12) {
  const chain = [];
  let url = startUrl;
  for (let i = 0; i < max; i++) {
    const r = await req(url, { headers: cookie ? { Cookie: cookie } : {} });
    chain.push({ url, status: r.status, location: r.location ?? null });
    if (r.status < 300 || r.status >= 400 || !r.location) {
      return { chain, finalUrl: url, finalStatus: r.status, finalBody: r.body };
    }
    url = new URL(r.location, url).href;
  }
  return { chain, finalUrl: url, finalStatus: null, finalBody: null, truncated: true };
}

function hasCommercialPlanCards(html) {
  if (typeof html !== 'string') return false;
  const markers = ['Starter', 'Pro', 'Business', 'startTrial', 'Choose Your Plan', 'choosePlan'];
  return markers.filter((m) => html.includes(m)).length >= 2;
}

// Step 1: OSS sign-up via dashboard BFF (normal UI path)
const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC081 IV Admin', email, password: pass }),
});
out.steps.push({ step: 'dashboard_register', status: signup.status, body: signup.body });

const setCookie = signup.headers['set-cookie'] ?? '';
const tokenMatch = setCookie.match(/__session=([^;]+)/);
const tokenFromCookie = tokenMatch?.[1];
const tokenFromCore =
  signup.status === 200
    ? null
    : null;

let token = tokenFromCookie;
if (!token) {
  const reg = await req(`${CORE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: pass,
      tenantName: 'AC081 IV Tenant',
      name: 'AC081 IV Admin',
    }),
  });
  out.steps.push({ step: 'core_register_fallback', status: reg.status, body: reg.body });
  token = reg.body?.token;
}
if (!token) throw new Error('no session token after register');

const cookie = `__session=${token}`;
out.cookie = cookie;

// Step 2: post-signup create-organization destination (server redirect chain)
const createOrg = await followRedirects(`${BASE}/create-organization`, cookie);
out.steps.push({
  step: 'create_organization_redirect_chain',
  chain: createOrg.chain,
  finalUrl: createOrg.finalUrl,
  finalStatus: createOrg.finalStatus,
});

// Step 3: dashboard home after org bootstrap (should not require choose-plan)
const dashboard = await followRedirects(`${BASE}/dashboard`, cookie);
out.steps.push({
  step: 'dashboard_redirect_chain',
  chain: dashboard.chain,
  finalUrl: dashboard.finalUrl,
  finalStatus: dashboard.finalStatus,
});

// Direct choose-plan visit (informational for AC-081 — required step vs bookmark)
const choosePlan = await followRedirects(`${BASE}/onboarding/choose-plan`, cookie);
const choosePlanHtml =
  typeof choosePlan.finalBody === 'string' ? choosePlan.finalBody : String(choosePlan.finalBody ?? '');
out.steps.push({
  step: 'choose_plan_direct_chain',
  chain: choosePlan.chain,
  finalUrl: choosePlan.finalUrl,
  finalStatus: choosePlan.finalStatus,
  hasCommercialPlanCards: hasCommercialPlanCards(choosePlanHtml),
});

const chainUrls = createOrg.chain.map((h) => h.url + (h.location ? ` -> ${h.location}` : ''));
const visitedChoosePlan = createOrg.chain.some(
  (h) =>
    h.url.includes('/onboarding/choose-plan') ||
    (h.location ?? '').includes('/onboarding/choose-plan'),
);
const finalIsDashboard =
  createOrg.finalUrl.includes('/dashboard') && !createOrg.finalUrl.includes('/onboarding/choose-plan');
const finalIsNonPlanOnboarding =
  createOrg.finalUrl.includes('/onboarding/') && !createOrg.finalUrl.includes('/onboarding/choose-plan');
const dashboardReachable =
  dashboard.finalUrl.includes('/dashboard') && !dashboard.chain.some((h) => (h.location ?? '').includes('choose-plan'));

out.eval = {
  register_ok: signup.status === 200,
  post_create_org_skips_choose_plan: !visitedChoosePlan,
  post_create_org_lands_dashboard_or_non_plan_onboarding: finalIsDashboard || finalIsNonPlanOnboarding,
  dashboard_access_without_choose_plan_gate: dashboardReachable,
  choose_plan_not_required_intermediate: !visitedChoosePlan && (finalIsDashboard || finalIsNonPlanOnboarding),
};

out.pass = Object.values(out.eval).every(Boolean);

fs.writeFileSync('.harness/wi-ac-081-iv-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
