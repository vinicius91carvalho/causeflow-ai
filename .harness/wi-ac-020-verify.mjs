/**
 * AC-020 verify — Integrations lists Test Application (OSS) with scope summary
 * and Learn more → public-docs Test Application page.
 */
import fs from 'node:fs';

const BASE = process.env.AC020_BASE_URL ?? 'http://127.0.0.1:5170';
const email = process.env.AC020_EMAIL ?? `vf-ac020-${Date.now()}@causeflow.local`;
const pass = process.env.AC020_PASS ?? 'TestPass123!';
const outPath = process.env.AC020_OUT ?? '.harness/wi-ac-020-verify-first.json';
const EXPECTED_DOCS =
  process.env.AC020_DOCS_URL ??
  'https://vinicius91carvalho.github.io/causeflow-ai/integrations/test-application';

const out = {
  id: 'WI-AC-020',
  phase: process.env.AC020_PHASE ?? 'verify-first',
  base: BASE,
  email,
  steps: [],
};

async function req(url, opts = {}) {
  const res = await fetch(url, { redirect: 'manual', ...opts });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    status: res.status,
    body,
    headers: Object.fromEntries(res.headers.entries()),
    text,
  };
}

const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC020 VF', email, password: pass }),
});
out.steps.push({ step: 'dashboard_register', status: signup.status });

const setCookie = signup.headers['set-cookie'] ?? '';
let token = setCookie.match(/__session=([^;]+)/)?.[1];
if (!token && signup.body?.token) token = signup.body.token;
if (!token) throw new Error('no session token after register');
const cookie = `__session=${token}`;

const catalog = await req(`${BASE}/api/integrations/catalog`, {
  headers: { Cookie: cookie },
});
const providers = catalog.body?.providers ?? [];
const stub = providers.find((p) => p?.id === 'stub-upstream') ?? null;
out.steps.push({ step: 'catalog', status: catalog.status, stub });

const nameOk = stub?.name === 'Test Application (OSS)';
const desc = stub?.description ?? '';
const descOk =
  desc.length >= 20 &&
  /demo|failure|catalog|runnable|connector/i.test(desc);
const learnUrl = stub?.learnMoreUrl ?? null;
const linkOk =
  learnUrl === EXPECTED_DOCS ||
  (typeof learnUrl === 'string' && learnUrl.endsWith('/integrations/test-application'));

out.expected_docs = EXPECTED_DOCS;
out.learnMoreUrl = learnUrl;
out.description = desc;
out.ac020_pass = Boolean(nameOk && descOk && linkOk);
out.defects = [];
if (!nameOk) out.defects.push('catalog missing Test Application (OSS)');
if (!descOk) out.defects.push('missing short scope summary on stub-upstream');
if (!linkOk) {
  out.defects.push(
    'learnMoreUrl missing or not pointing at public-docs Test Application page',
  );
}

fs.mkdirSync(outPath.includes('/') ? outPath.replace(/[^/]+$/, '') : '.', { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
if (!out.ac020_pass) {
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ac020_pass: true, learnMoreUrl: learnUrl }, null, 2));
