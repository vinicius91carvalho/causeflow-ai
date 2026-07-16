import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5170';
const CORE = 'http://127.0.0.1:3099';
const email = `iv-ac072-${Date.now()}@causeflow.local`;
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

async function waitTestApp() {
  for (let i = 0; i < 30; i++) {
    try {
      const h = await fetch('http://127.0.0.1:5190/health', { signal: AbortSignal.timeout(1000) });
      if (h.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('test-app health timeout');
}

const reg = await req(`${CORE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pass, tenantName: 'AC072 IV Tenant', name: 'AC072 Admin' }),
});
out.steps.push({ step: 'register', status: reg.status, body: reg.body });
const token = reg.body?.token;
if (!token) throw new Error('no token');
const cookie = `__session=${token}`;

try {
  execSync('docker stop core-causeflow-test-app-1', { stdio: 'pipe' });
  out.steps.push({ step: 'stop_test_app', stopped: true });
} catch (e) {
  out.steps.push({ step: 'stop_test_app', stopped: false, error: String(e.message) });
}

const connect = await req(`${BASE}/api/integrations/stub/connect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: '{}',
});
out.steps.push({ step: 'stub_connect_down', status: connect.status, body: connect.body });

const testDown = await req(`${BASE}/api/integrations/test`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ type: 'stub-upstream' }),
});
out.steps.push({ step: 'generic_test_down', status: testDown.status, body: testDown.body });

const probe = await req(`${BASE}/api/integrations/stub/probe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: '{}',
});
out.steps.push({ step: 'stub_probe_down', status: probe.status, body: probe.body });

let testAfterConnect;
try {
  execSync('docker start core-causeflow-test-app-1', { stdio: 'pipe' });
  await waitTestApp();

  const connectUp = await req(`${BASE}/api/integrations/stub/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  });
  out.steps.push({ step: 'stub_connect_up', status: connectUp.status, body: connectUp.body });

  execSync('docker stop core-causeflow-test-app-1', { stdio: 'pipe' });
  out.steps.push({ step: 'stop_test_app_again', stopped: true });

  testAfterConnect = await req(`${BASE}/api/integrations/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'stub-upstream' }),
  });
  out.steps.push({
    step: 'generic_test_after_connect_down',
    status: testAfterConnect.status,
    body: testAfterConnect.body,
  });

  const probeAfter = await req(`${BASE}/api/integrations/stub/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  });
  out.steps.push({
    step: 'stub_probe_after_connect_down',
    status: probeAfter.status,
    body: probeAfter.body,
  });

  const list = await req(`${BASE}/api/integrations`, { headers: { Cookie: cookie } });
  const stub = Array.isArray(list.body)
    ? list.body.find((i) => i.type === 'stub-upstream' || i.provider === 'stub-upstream')
    : null;
  out.steps.push({ step: 'integrations_list', status: list.status, stub });

  execSync('docker start core-causeflow-test-app-1', { stdio: 'pipe' });
} catch (e) {
  out.steps.push({ step: 'connected_flow_error', error: String(e.message) });
  try {
    execSync('docker start core-causeflow-test-app-1', { stdio: 'pipe' });
  } catch {
    // ignore
  }
}

let dashProbeMatches = '';
try {
  dashProbeMatches = execSync('rg -l "stub/probe|probeStubIntegration" apps/dashboard || true', {
    cwd: '/home/vinicius/projects/causeflow-ai/web',
    encoding: 'utf8',
  }).trim();
} catch {
  dashProbeMatches = '';
}
out.grep_dashboard_stub_probe = dashProbeMatches || 'no matches';

const client = fs.readFileSync(
  '/home/vinicius/projects/causeflow-ai/web/apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx',
  'utf8',
);
out.handleTest_has_stub_branch = /stub-upstream[\s\S]{0,200}stub\/probe/.test(client);
out.handleTest_uses_generic_only = client.includes("fetch('/api/integrations/test'");

out.eval = {
  connect_fail_with_unreachable:
    connect.status >= 400 && JSON.stringify(connect.body).toLowerCase().includes('unreachable'),
  test_false_success_when_down: testAfterConnect?.body?.success === true,
  stub_probe_route_missing: probe.status === 404,
  dashboard_has_stub_probe_grep: dashProbeMatches !== 'no matches' && dashProbeMatches.length > 0,
};

fs.writeFileSync('.harness/wi-ac-072-iv-http.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
