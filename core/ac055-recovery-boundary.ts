/**
 * AC-055 recovery: mock Ornith on MOCK_LLM_PORT restores triage completions.
 */
import http from 'node:http';

const MOCK_PORT = Number(process.env['MOCK_LLM_PORT'] ?? 18081);

const mockServer = http.createServer(async (req, res) => {
  if (req.url === '/v1/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'Ornith-1.0-9B-code' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const wantsJson = body.includes('json_object') || body.includes('Respond with a single JSON');
    const content = wantsJson
      ? JSON.stringify({
          priority: 'low',
          suggestedAgents: ['log_analyst'],
          summary: 'AC-055 mock triage completion',
          confidence: 0.9,
          category: 'application',
          investigationMode: 'orchestrator',
        })
      : JSON.stringify({
          findings: [{ text: 'mock finding', evidenceIds: [] }],
          potentialRootCause: 'AC-055 mock root cause',
          recommendedActions: [],
        });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      model: 'Ornith-1.0-9B-code',
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

await new Promise<void>((resolve) => mockServer.listen(MOCK_PORT, '127.0.0.1', resolve));

process.env['CAUSEFLOW_RUNTIME'] = 'oss';
process.env['NODE_ENV'] = 'development';
process.env['PORT'] = process.env['PORT'] ?? '5172';
process.env['DATABASE_URL'] = process.env['DATABASE_URL']
  ?? 'postgresql://causeflow:causeflow@127.0.0.1:5439/causeflow';
process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6380';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'oss-dev-jwt-secret-change-me';
process.env['TOKEN_ENCRYPTION_KEY'] = process.env['TOKEN_ENCRYPTION_KEY']
  ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env['HINDSIGHT_BASE_URL'] = process.env['HINDSIGHT_BASE_URL'] ?? 'http://127.0.0.1:8888';
process.env['WEBHOOK_SECRET'] = process.env['WEBHOOK_SECRET'] ?? 'oss-dev-webhook-secret';
process.env['ANTHROPIC_API_KEY'] = '';
process.env['LLM_BASE_URL'] = `http://127.0.0.1:${MOCK_PORT}/v1`;
process.env['LLM_MODEL'] = 'Ornith-1.0-9B-code';

const PORT = Number(process.env['PORT']);
const BASE = `http://127.0.0.1:${PORT}`;

const { serve } = await import('@hono/node-server');
const { bootstrap } = await import('./src/bootstrap.js');
const { createApp } = await import('./src/app.js');

const ctx = await bootstrap({ inProcessPipeline: true });
const app = createApp(ctx);
serve({ fetch: app.fetch, port: PORT });

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const health = await (await fetch(`${BASE}/health`)).json() as Record<string, string>;
console.log('health', health);
if (health['llm'] !== 'ok') fail(`expected llm=ok with mock Ornith, got ${health['llm']}`);

const reg = await (await fetch(`${BASE}/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `ac055-recovery-${Date.now()}@example.com`,
    password: 'testpass123',
    tenantName: 'AC055 Recovery',
  }),
})).json() as { token?: string };
if (!reg.token) fail('register missing token');

const inc = await (await fetch(`${BASE}/v1/incidents`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${reg.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'AC055 recovery',
    description: 'Ornith mock up — triage should complete',
  }),
})).json() as { incidentId?: string };
if (!inc.incidentId) fail('missing incidentId');

let status = '';
let severity = '';
for (let i = 0; i < 10; i++) {
  const row = await (await fetch(`${BASE}/v1/incidents/${inc.incidentId}`, {
    headers: { Authorization: `Bearer ${reg.token}` },
  })).json() as { status?: string; severity?: string };
  status = row.status ?? '';
  severity = row.severity ?? '';
  console.log(`poll ${i}: status=${status} severity=${severity}`);
  if (status === 'failed') fail('incident failed after Ornith recovery');
  if (status === 'resolved' && severity === 'low') {
    console.log('PASS: AC-055 Ornith recovery boundary (triage completion restored)');
    mockServer.close();
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 300));
}
fail(`Ornith recovery did not restore triage (status=${status}, severity=${severity})`);
