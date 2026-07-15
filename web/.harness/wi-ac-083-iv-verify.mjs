/**
 * AC-083 HTTP marker scan — used by integration verification.
 * Writes `.harness/wi-ac-083-iv-http.json` with per-route clean flags.
 */
import fs from 'node:fs';

const BASE = process.env.AC083_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC083_CORE_URL ?? 'http://127.0.0.1:3099';
const email = `iv-ac083-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const out = { base: BASE, core: CORE, email, routes: [], steps: [] };

const PAID_PLAN_MARKERS = [
  { id: 'choose_your_plan', pattern: /Choose Your Plan/i },
  { id: 'select_a_plan', pattern: /Select a plan/i },
  { id: 'upgrade_plan_button', pattern: /Upgrade Plan/i },
  { id: 'upgrade_your_plan', pattern: /upgrade your plan/i },
  { id: 'manage_subscription', pattern: /manage your subscription/i },
  { id: 'credits_and_plans', pattern: /Credits & Plans/i },
  { id: 'choose_plan_href', pattern: /href="[^"]*\/onboarding\/choose-plan"/i },
  { id: 'pricing_upgrade_href', pattern: /href="[^"]*\/pricing"/i },
  { id: 'start_trial', pattern: /startTrial|Start Trial/i },
  // Distinct plan-tier names only — avoids false positives on "business-profile" paths
  {
    id: 'commercial_plan_cards',
    pattern:
      /\bStarter\b.{0,120}\b(?:Pro|Business)\b|\bPro\b.{0,120}\b(?:Starter|Business)\b|\bBusiness\b.{0,120}\b(?:Starter|Pro)\b/i,
  },
  { id: 'checkout_cta', pattern: /complete checkout|checkout session|Select plan/i },
];

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
  return {
    status: res.status,
    location,
    body,
    headers: Object.fromEntries(res.headers.entries()),
    text,
  };
}

async function followRedirects(startUrl, cookie, max = 12) {
  const chain = [];
  let url = startUrl;
  let finalText = '';
  for (let i = 0; i < max; i++) {
    const r = await req(url, { headers: cookie ? { Cookie: cookie } : {} });
    finalText = typeof r.body === 'string' ? r.body : r.text;
    chain.push({ url, status: r.status, location: r.location ?? null });
    if (r.status < 300 || r.status >= 400 || !r.location) {
      return { chain, finalUrl: url, finalStatus: r.status, html: finalText };
    }
    url = new URL(r.location, url).href;
  }
  return { chain, finalUrl: url, finalStatus: null, html: finalText, truncated: true };
}

function scanPaidPlanCopy(html) {
  const hits = [];
  for (const marker of PAID_PLAN_MARKERS) {
    if (marker.pattern.test(html)) hits.push(marker.id);
  }
  return hits;
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC083 IV Admin', email, password: pass }),
});
out.steps.push({ step: 'dashboard_register', status: signup.status });

const setCookie = signup.headers['set-cookie'] ?? '';
const tokenMatch = setCookie.match(/__session=([^;]+)/);
let token = tokenMatch?.[1];
if (!token) {
  const reg = await req(`${CORE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: pass,
      tenantName: 'AC083 IV Tenant',
      name: 'AC083 IV Admin',
    }),
  });
  out.steps.push({ step: 'core_register_fallback', status: reg.status });
  token = reg.body?.token;
}
if (!token) throw new Error('no session token after register');
const cookie = `__session=${token}`;
out.cookie = cookie;

const surfaces = [
  { name: 'onboarding_welcome', url: `${BASE}/onboarding/welcome` },
  { name: 'onboarding_business_profile', url: `${BASE}/onboarding/business-profile` },
  { name: 'onboarding_integrations', url: `${BASE}/onboarding/integrations` },
  { name: 'dashboard_home', url: `${BASE}/dashboard` },
  { name: 'dashboard_settings', url: `${BASE}/dashboard/settings` },
  { name: 'dashboard_settings_company_tab', url: `${BASE}/dashboard/settings?tab=company` },
];

for (const surface of surfaces) {
  const result = await followRedirects(surface.url, cookie);
  const hits = scanPaidPlanCopy(result.html ?? '');
  out.routes.push({
    surface: surface.name,
    finalUrl: result.finalUrl,
    finalStatus: result.finalStatus,
    paid_plan_markers: hits,
    clean: hits.length === 0,
  });
}

const dashboardRoute = out.routes.find((r) => r.surface === 'dashboard_home');

out.eval = {
  register_ok: signup.status === 200 || Boolean(token),
  no_paid_plan_on_onboarding_welcome: out.routes
    .filter((r) => r.surface.startsWith('onboarding_'))
    .every((r) => r.clean),
  no_paid_plan_on_settings: out.routes
    .filter((r) => r.surface.startsWith('dashboard_settings'))
    .every((r) => r.clean),
  no_paid_plan_on_dashboard: dashboardRoute?.clean === true,
  all_surfaces_clean: out.routes.every((r) => r.clean),
};

out.pass = Object.values(out.eval).every(Boolean);
out.defects = out.routes
  .filter((r) => !r.clean)
  .map(
    (r) =>
      `expected no paid-plan selection/upgrade/checkout copy on ${r.surface}; observed markers ${r.paid_plan_markers.join(', ')}; evidence GET ${r.finalUrl} finalStatus=${r.finalStatus}`,
  );

fs.mkdirSync('.harness', { recursive: true });
fs.writeFileSync('.harness/wi-ac-083-iv-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
