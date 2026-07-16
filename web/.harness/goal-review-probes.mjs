import fs from 'node:fs';

const out = { at: new Date().toISOString(), website: {}, dashboard: {}, core: {}, static: {}, defects: [] };
const W = 'http://127.0.0.1:3000';
const D = 'http://127.0.0.1:3001';
const C = 'http://127.0.0.1:3099';
const Docs = 'http://127.0.0.1:5181';

async function req(url, opts = {}, ms = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { redirect: 'manual', ...opts, signal: ac.signal });
    const text = await res.text().catch(() => '');
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    let body;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 2500); }
    return { status: res.status, headers, body, location: res.headers.get('location') };
  } catch (e) {
    return { status: 0, headers: {}, body: String(e), location: null };
  } finally {
    clearTimeout(t);
  }
}

function fail(id, expected, observed, evidence) {
  out.defects.push({ id, expected, observed, evidence });
}

const routes = ['/', '/product', '/security', '/integrations', '/pricing', '/use-cases', '/from-opsgenie', '/privacy', '/terms'];

const health = await req(`${C}/health`);
out.core.health = { status: health.status, body: health.body };
if (health.status !== 200) fail('AC-044/AC-068', 'Core /health 200', `status=${health.status}`, JSON.stringify(health.body));

const docs = await req(`${Docs}/`);
out.docs = { status: docs.status };
if (docs.status !== 200) fail('AC-068', 'docs :5181 200', `status=${docs.status}`, 'docs');

out.website.en = {};
out.website.pt = {};
for (const r of routes) {
  const a = await req(`${W}${r}`);
  out.website.en[r] = a.status;
  if (a.status !== 200) fail('AC-010', `${r} 200`, `status=${a.status}`, W + r);
  const ptPath = r === '/' ? '/pt-br' : `/pt-br${r}`;
  const b = await req(`${W}${ptPath}`);
  out.website.pt[r] = b.status;
  if (b.status !== 200) fail('AC-010', `${ptPath} 200`, `status=${b.status}`, W + ptPath);
}

const home = await req(`${W}/`);
const html = typeof home.body === 'string' ? home.body : '';
const csp = home.headers['content-security-policy'] || '';
out.website.headers = {
  xfo: home.headers['x-frame-options'],
  csp: csp.slice(0, 500),
  hsts: home.headers['strict-transport-security'],
  referrer: home.headers['referrer-policy'],
};
out.website.hreflang = /hreflang/i.test(html);
out.website.docsLink = html.includes('vinicius91carvalho.github.io/causeflow-ai');
out.website.loopsInCsp = /loops\.so/i.test(csp);
if ((home.headers['x-frame-options'] || '').toUpperCase() !== 'DENY') fail('AC-013', 'X-Frame-Options DENY', String(home.headers['x-frame-options']), 'GET /');
if (!csp) fail('AC-013', 'CSP present', 'missing', 'GET /');
if (out.website.loopsInCsp) fail('AC-052', 'no loops.so in CSP', 'loops present', csp.slice(0, 200));
if (!out.website.hreflang) fail('AC-011', 'hreflang in /', 'missing', 'homepage');
if (!out.website.docsLink) fail('AC-066', 'GitHub Pages docs URL', 'missing', 'homepage');

const bot = await req(`${W}/`, { headers: { 'User-Agent': 'Googlebot/2.1' } });
out.website.googlebot = { status: bot.status, location: bot.location };
if (bot.status !== 200) fail('AC-012', 'Googlebot / → 200', `status=${bot.status}`, String(bot.location));

const gs = await req(`${W}/get-started`);
const gsPt = await req(`${W}/pt-br/get-started`);
out.website.getStarted = { status: gs.status, location: gs.location };
out.website.getStartedPt = { status: gsPt.status, location: gsPt.location };
const want = 'http://localhost:3001/auth/sign-up';
if (![301, 302, 307, 308].includes(gs.status) || gs.location !== want) fail('AC-014', `redirect ${want}`, `${gs.status} ${gs.location}`, '/get-started');
if (![301, 302, 307, 308].includes(gsPt.status) || gsPt.location !== want) fail('AC-014', `pt redirect ${want}`, `${gsPt.status} ${gsPt.location}`, '/pt-br/get-started');

out.website.robots = (await req(`${W}/robots.txt`)).status;
out.website.sitemap = (await req(`${W}/sitemap.xml`)).status;
if (out.website.robots !== 200) fail('AC-016', 'robots.txt 200', String(out.website.robots), '/robots.txt');
if (out.website.sitemap !== 200) fail('AC-016', 'sitemap.xml 200', String(out.website.sitemap), '/sitemap.xml');

const dashHome = await req(`${D}/dashboard`);
const signIn = await req(`${D}/auth/sign-in`);
out.dashboard.unauthDash = { status: dashHome.status, location: dashHome.location };
out.dashboard.signIn = {
  status: signIn.status,
  hasClerk: /clerk\.(accounts|com)/i.test(String(signIn.body)),
  hasForm: /password|sign.?in|email/i.test(String(signIn.body)),
};
if (![301, 302, 307, 308].includes(dashHome.status) || !String(dashHome.location || '').includes('/auth/sign-in')) {
  fail('AC-019', 'unauth /dashboard → /auth/sign-in', `${dashHome.status} ${dashHome.location}`, '/dashboard');
}
if (signIn.status !== 200 || out.dashboard.signIn.hasClerk) fail('AC-046', 'local sign-in 200 no Clerk UI', JSON.stringify(out.dashboard.signIn), '/auth/sign-in');

const unauthApi = await req(`${D}/api/incidents`);
out.dashboard.unauthApi = { status: unauthApi.status, body: unauthApi.body };
if (unauthApi.status !== 401) fail('AC-029', 'unauth /api/incidents 401', String(unauthApi.status), JSON.stringify(unauthApi.body).slice(0, 200));

out.dashboard.health = {
  health: (await req(`${D}/api/health`)).status,
  detailed: (await req(`${D}/api/health/detailed`)).status,
};

const email = `gr-${Date.now()}@causeflow.local`;
const pass = 'TestPass123!';
const reg = await req(`${C}/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pass, tenantName: 'Goal Review Tenant', name: 'GR Admin' }),
});
out.auth = { email, status: reg.status, hasToken: !!(reg.body && reg.body.token) };
const token = reg.body?.token;
if (!token) {
  fail('AC-053', 'Core register token', `status=${reg.status}`, JSON.stringify(reg.body).slice(0, 300));
} else {
  const cookie = `__session=${token}`;
  const authed = await req(`${D}/dashboard`, { headers: { Cookie: cookie } });
  out.dashboard.authedHome = { status: authed.status, location: authed.location, len: String(authed.body).length };

  const billingPage = await req(`${D}/dashboard/billing`, { headers: { Cookie: cookie } });
  out.dashboard.billingPage = { status: billingPage.status, location: billingPage.location };
  const billingHtml = String(billingPage.body);
  if (/investigations left|Buy more|credits remaining/i.test(billingHtml) && billingPage.status === 200) {
    fail('AC-073/AC-076', 'no credits chrome on billing', 'credits chrome found', billingHtml.slice(0, 200));
  }
  if ([301, 302, 307, 308].includes(billingPage.status) && /billing/.test(String(billingPage.location || '')) && !/dashboard\/?$/.test(String(billingPage.location || '').replace(/\/billing.*/, '/dashboard'))) {
    // still ok if redirects somewhere without commercial UI
  }
  if ([301, 302, 307, 308].includes(billingPage.status) && String(billingPage.location || '').includes('/dashboard') && !String(billingPage.location || '').includes('/billing')) {
    out.dashboard.billingRedirectOk = true;
  } else if (billingPage.status === 200 && !/Buy more|investigations left/i.test(billingHtml)) {
    out.dashboard.billingRedirectOk = '200-no-credits-chrome';
  } else if (![301, 302, 307, 308, 200].includes(billingPage.status)) {
    fail('AC-073', 'billing redirects or non-commercial', `${billingPage.status} ${billingPage.location}`, 'billing page');
  }

  for (const path of ['/api/billing/checkout', '/api/billing/portal']) {
    const r = await req(`${D}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ planId: 'starter' }),
    });
    out.dashboard[path] = { status: r.status, body: r.body };
    if (r.status !== 410) fail('AC-075', `${path} 410`, `status=${r.status}`, JSON.stringify(r.body).slice(0, 200));
  }
  for (const path of ['/v1/billing/checkout', '/v1/billing/portal']) {
    const r = await req(`${C}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planKey: 'starter', successUrl: 'http://x/s', cancelUrl: 'http://x/c', returnUrl: 'http://x/' }),
    });
    out.core[path] = { status: r.status, body: r.body };
    if (r.status !== 410) fail('AC-075', `Core ${path} 410`, `status=${r.status}`, JSON.stringify(r.body).slice(0, 200));
  }

  const catalog = await req(`${D}/api/integrations/catalog`, { headers: { Cookie: cookie } });
  const catStr = JSON.stringify(catalog.body);
  out.dashboard.catalog = { status: catalog.status, snippet: catStr.slice(0, 600) };
  out.dashboard.catalogHasStub = /Test Application|stub-upstream|stub_upstream|test.app/i.test(catStr);
  out.dashboard.catalogHasComposio = /composio\.dev/i.test(catStr);
  if (out.dashboard.catalogHasComposio) fail('AC-051', 'no composio.dev in catalog', 'present', catStr.slice(0, 200));
  if (catalog.status === 200 && !out.dashboard.catalogHasStub) fail('AC-070', 'catalog Test Application (OSS)', 'not found', catStr.slice(0, 300));

  // Connect stub if possible
  let connect = await req(`${D}/api/integrations/stub/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({}),
  });
  if (connect.status >= 400) {
    connect = await req(`${D}/api/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ type: 'stub-upstream', name: 'Test Application (OSS)' }),
    });
  }
  out.dashboard.connect = { status: connect.status, body: connect.body };
  const probe = await req(`${D}/api/integrations/stub/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({}),
  });
  out.dashboard.probe = { status: probe.status, body: probe.body };

  let inc = await req(`${D}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ title: 'Goal Review incident', description: 'AC-074' }),
  });
  if (inc.status >= 400) {
    inc = await req(`${C}/v1/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Goal Review incident', description: 'AC-074', severity: 'high' }),
    });
  }
  out.incident = { status: inc.status, body: inc.body, any402: inc.status === 402 };
  if (out.incident.any402) fail('AC-074', 'create without 402', '402', JSON.stringify(inc.body).slice(0, 200));
}

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const dashPkg = read('apps/dashboard/package.json');
out.static = {
  clerk: /@clerk\//.test(dashPkg),
  stripe: /"stripe"|@stripe\//.test(dashPkg),
  aws: /@aws-sdk\/client-dynamodb|@aws-sdk\/lib-dynamodb|@aws-sdk\/client-cognito/.test(dashPkg),
  addCredits: fs.existsSync('apps/dashboard/scripts/add-credits.ts'),
  sstWeb: fs.existsSync('apps/website/sst.config.ts'),
  sstDash: fs.existsSync('apps/dashboard/sst.config.ts'),
  sentryWrap: /withSentryConfig/.test(read('apps/dashboard/next.config.mjs')),
  composioCfg: /composio\.dev/.test(read('apps/dashboard/next.config.mjs')),
  composioType: /composioTriggerId/.test(read('apps/dashboard/src/contexts/integrations/domain/types.ts')),
  loopsEnv: /LOOPS_API_KEY/.test(read('apps/website/.env.example')),
  lvh: /lvh\.me/.test(read('apps/dashboard/src/middleware.ts')),
  stubUrl: /STUB_UPSTREAM_BASE_URL:\s*http:\/\/causeflow-test-app:5190/.test(read('docker-compose.yml')),
  pkgMgr: JSON.parse(read('package.json') || '{}').packageManager,
};
for (const [k, id, msg] of [
  ['clerk', 'AC-047', 'no clerk deps'],
  ['stripe', 'AC-048', 'no stripe deps'],
  ['aws', 'AC-049', 'no aws sdk'],
  ['addCredits', 'AC-075', 'add-credits removed'],
  ['sstWeb', 'AC-050', 'sst website removed'],
  ['sstDash', 'AC-050', 'sst dashboard removed'],
  ['sentryWrap', 'AC-050', 'withSentryConfig removed'],
  ['composioCfg', 'AC-051', 'composio config removed'],
  ['composioType', 'AC-051', 'composioTriggerId removed'],
  ['loopsEnv', 'AC-052', 'LOOPS_API_KEY removed'],
  ['lvh', 'AC-052', 'lvh.me removed'],
]) {
  if (out.static[k]) fail(id, msg, 'found', k);
}
if (!out.static.stubUrl) fail('AC-069', 'stub service DNS in compose', 'missing', 'docker-compose.yml');

const ta = await req('http://127.0.0.1:5190/health');
out.testApp = { status: ta.status, body: ta.body };
if (ta.status !== 200) fail('AC-069', 'test-app health 200', `status=${ta.status}`, '5190');

const root = '/home/vinicius/projects/causeflow-ai';
out.static.rootCompose = fs.existsSync(`${root}/docker-compose.yml`);
out.static.init = fs.existsSync(`${root}/init.sh`);
out.static.readme = /init\.sh/.test(read(`${root}/README.md`));
out.static.docsWf = fs.existsSync(`${root}/.github/workflows/docs-pages.yml`) && /mint export/.test(read(`${root}/.github/workflows/docs-pages.yml`));

fs.writeFileSync('.harness/goal-review-live-probes.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  defectCount: out.defects.length,
  defects: out.defects,
  getStarted: out.website.getStarted,
  enOk: Object.values(out.website.en || {}).every((s) => s === 200),
  ptOk: Object.values(out.website.pt || {}).every((s) => s === 200),
  signIn: out.dashboard.signIn,
  unauthApi: out.dashboard.unauthApi?.status,
  checkout: out.dashboard['/api/billing/checkout'],
  catalogStub: out.dashboard.catalogHasStub,
  connect: out.dashboard.connect?.status,
  probe: out.dashboard.probe?.status,
  incident: out.incident?.status,
  billingPage: out.dashboard.billingPage,
  coreHealth: out.core.health?.status,
  testApp: out.testApp?.status,
  docs: out.docs?.status,
  headers: out.website.headers,
  hreflang: out.website.hreflang,
  docsLink: out.website.docsLink,
  loops: out.website.loopsInCsp,
}, null, 2));
