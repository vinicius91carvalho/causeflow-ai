/**
 * AC-055 boundary: black-box HTTP verification for Ornith fail-closed behavior.
 * Run with LLM_BASE_URL pointing at an unreachable port (Ornith stopped).
 */
process.env['CAUSEFLOW_RUNTIME'] = 'oss';
process.env['NODE_ENV'] = 'development';
process.env['PORT'] = process.env['PORT'] ?? '5171';
process.env['DATABASE_URL'] = process.env['DATABASE_URL']
  ?? 'postgresql://causeflow:causeflow@127.0.0.1:5439/causeflow';
process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6380';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'oss-dev-jwt-secret-change-me';
process.env['TOKEN_ENCRYPTION_KEY'] = process.env['TOKEN_ENCRYPTION_KEY']
  ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env['HINDSIGHT_BASE_URL'] = process.env['HINDSIGHT_BASE_URL'] ?? 'http://127.0.0.1:8888';
process.env['WEBHOOK_SECRET'] = process.env['WEBHOOK_SECRET'] ?? 'oss-dev-webhook-secret';
process.env['ANTHROPIC_API_KEY'] = '';
process.env['LLM_BASE_URL'] = process.env['LLM_BASE_URL'] ?? 'http://127.0.0.1:59999/v1';
process.env['LLM_MODEL'] = process.env['LLM_MODEL'] ?? 'Ornith-1.0-9B-code';

const PORT = Number(process.env['PORT']);
const BASE = `http://127.0.0.1:${PORT}`;

const { serve } = await import('@hono/node-server');
const { bootstrap } = await import('./src/bootstrap.js');
const { createApp } = await import('./src/app.js');

const ctx = await bootstrap({ inProcessPipeline: true });
const app = createApp(ctx);
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`AC-055 boundary listening on ${PORT}`);
});

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// 1. Health reports llm degraded
const healthRes = await fetch(`${BASE}/health`);
const health = await healthRes.json() as Record<string, string>;
console.log('health', health);
if (health['llm'] !== 'degraded') fail(`expected llm=degraded, got ${health['llm']}`);

// 2. Register + create incident
const reg = await fetch(`${BASE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `ac055-${Date.now()}@example.com`,
    password: 'testpass123',
    tenantName: 'AC055 Boundary',
  }),
});
const regBody = await reg.json() as { token?: string };
const token = regBody.token;
if (!token) fail('register missing token');

const incRes = await fetch(`${BASE}/v1/incidents`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'AC055 boundary',
    description: 'Ornith unreachable — triage must fail closed',
  }),
});
const inc = await incRes.json() as { incidentId?: string };
if (!inc.incidentId) fail('missing incidentId');

// 3. Poll — must fail closed within 30s, not hang or resolve
let status = '';
for (let i = 0; i < 30; i++) {
  const rowRes = await fetch(`${BASE}/v1/incidents/${inc.incidentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const row = await rowRes.json() as { status?: string };
  status = row.status ?? '';
  console.log(`poll ${i}: status=${status}`);
  if (status === 'failed') break;
  if (status === 'resolved' || status === 'investigating') {
    fail(`silent pass: incident reached ${status} with Ornith down`);
  }
  await sleep(1000);
}
if (status !== 'failed') fail(`expected failed within 30s, got ${status}`);

const invRes = await fetch(`${BASE}/api/v1/investigation/${inc.incidentId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const inv = await invRes.json() as { status?: string };
console.log('investigation', inv);
if (inv.status !== 'failed') fail(`expected investigation status failed, got ${inv.status}`);

console.log('PASS: AC-055 fail-closed boundary');
process.exit(0);
