/**
 * AC-021 verify-first — Authenticated Connect for Test Application (OSS)
 * succeeds when the test app is healthy and persists a connected integration
 * named Test Application (OSS).
 *
 * Boundary: dashboard BFF :5170 → Core :3099 → causeflow-test-app :5190
 */
import fs from 'node:fs';

const BASE = process.env.AC021_BASE_URL ?? 'http://127.0.0.1:5170';
const CORE = process.env.AC021_CORE_URL ?? 'http://127.0.0.1:3099';
const TEST_APP = process.env.AC021_TEST_APP_URL ?? 'http://127.0.0.1:5190';
const email = process.env.AC021_EMAIL ?? `vf-ac021-${Date.now()}@causeflow.local`;
const pass = process.env.AC021_PASS ?? 'TestPass123!';
const outPath = process.env.AC021_OUT ?? '.harness/wi-ac-021-verify-first.json';

const out = {
  id: 'WI-AC-021',
  phase: process.env.AC021_PHASE ?? 'verify-first-existing',
  acceptance_check_id: 'AC-021',
  observation_method: 'http',
  base: BASE,
  core: CORE,
  testApp: TEST_APP,
  email,
  steps: [],
  pass: false,
  defects: [],
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
  const setCookie =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return {
    status: res.status,
    body,
    text,
    setCookie,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

function extractSessionCookie(setCookie, headers) {
  const hit = (setCookie ?? []).find((c) => c.startsWith('__session='));
  if (hit) return hit.split(';')[0];
  const raw = headers['set-cookie'] ?? '';
  const m = String(raw).match(/__session=([^;]+)/);
  return m ? `__session=${m[1]}` : null;
}

function writeOut() {
  fs.mkdirSync('.harness', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
}

function isConnectedStatus(status) {
  return ['active', 'connected'].includes(String(status ?? '').toLowerCase());
}

function findStub(integrations) {
  return (integrations ?? []).find(
    (i) => i?.provider === 'stub-upstream' || i?.type === 'stub-upstream',
  );
}

// 0) Test app must be healthy (AC precondition)
const health = await req(`${TEST_APP}/health`);
out.steps.push({ step: 'test_app_health', status: health.status, body: health.body });
if (health.status < 200 || health.status >= 300) {
  out.defects.push(`test app not healthy at ${TEST_APP}/health (HTTP ${health.status})`);
  writeOut();
  process.exit(1);
}

// 1) Authenticated register (admin session)
const signup = await req(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'AC021 VF Admin', email, password: pass }),
});
out.steps.push({ step: 'dashboard_register', status: signup.status, body: signup.body });

let cookie = extractSessionCookie(signup.setCookie, signup.headers);
if (!cookie && signup.body?.token) cookie = `__session=${signup.body.token}`;
if (!cookie) {
  const reg = await req(`${CORE}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: pass,
      tenantName: 'AC021 VF Tenant',
      name: 'AC021 VF Admin',
    }),
  });
  out.steps.push({ step: 'core_register_fallback', status: reg.status, body: reg.body });
  if (reg.body?.token) cookie = `__session=${reg.body.token}`;
}
if (!cookie) {
  out.defects.push('expected session cookie after register; observed missing token');
  writeOut();
  process.exit(1);
}

const authHeaders = { Cookie: cookie, 'Content-Type': 'application/json' };

// 2) Authenticated Connect for Test Application (OSS)
const connect = await req(`${BASE}/api/integrations/stub/connect`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({}),
});
out.steps.push({ step: 'stub_connect', status: connect.status, body: connect.body });
if (connect.status < 200 || connect.status >= 300) {
  out.defects.push(
    `stub/connect failed while test app healthy: HTTP ${connect.status} ${JSON.stringify(connect.body)}`,
  );
  writeOut();
  process.exit(1);
}

// 3) Persist: GET /api/integrations must list connected Test Application (OSS)
const list = await req(`${BASE}/api/integrations`, { headers: { Cookie: cookie } });
const integrations = list.body?.integrations ?? [];
const stub = findStub(integrations);
out.steps.push({
  step: 'list_integrations',
  status: list.status,
  stub,
  integrationCount: integrations.length,
});

if (list.status < 200 || list.status >= 300) {
  out.defects.push(`GET /api/integrations failed: HTTP ${list.status}`);
}
if (!stub) {
  out.defects.push('expected stub-upstream integration after connect');
} else {
  const name = String(stub.name ?? stub.displayName ?? '');
  if (name !== 'Test Application (OSS)') {
    out.defects.push(
      `expected persisted name "Test Application (OSS)", got ${JSON.stringify(name)}`,
    );
  }
  if (!isConnectedStatus(stub.status)) {
    out.defects.push(
      `expected connected/active status, got ${JSON.stringify(stub.status)}`,
    );
  }
}

// 4) Core-side confirmation (optional strong evidence)
const coreList = await req(`${CORE}/v1/integrations`, {
  headers: { Authorization: `Bearer ${cookie.replace('__session=', '')}` },
});
out.steps.push({
  step: 'core_list_integrations',
  status: coreList.status,
  body:
    typeof coreList.body === 'object'
      ? {
          integrations: (coreList.body?.integrations ?? coreList.body ?? []).slice?.(0, 5),
        }
      : coreList.body,
});

out.pass = out.defects.length === 0;
out.notes = out.pass
  ? 'Authenticated stub/connect succeeded with healthy test-app; GET /api/integrations persists connected Test Application (OSS).'
  : out.defects.join('; ');

writeOut();
if (!out.pass) {
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      ac021_pass: true,
      stub: findStub(integrations),
      connectStatus: connect.status,
    },
    null,
    2,
  ),
);
