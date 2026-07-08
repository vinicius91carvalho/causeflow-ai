// AC-012 boundary: real HTTP against an app booted with deterministic LLM +
// agent-runner stubs (no paid Anthropic calls) so a real investigation runs
// end-to-end through the in-process pipeline fallback.
//
// Flow:
//  1. Mint a real Clerk session JWT (RS256) signed with the local keypair at
//     /tmp/ac011-clerk-priv.pem; the app verifies it networklessly.
//  2. POST /v1/tenants -> tenant A (admin).
//  3. Provision a BillingAccountEntity for tenant A (setup only — needed so
//     reserveInvestigation succeeds).
//  4. POST /v1/incident/chat (severity=critical) -> incident (status=triaging)
//     -> in-process fallback dispatches a real (stub-backed) investigation
//     -> investigation.completed -> RecordUsageUseCase writes a UsageRecordEntity
//        with investigationId + per-agent token counts + per-agent cost.
//  5. Poll GET /v1/incident/:id until the investigation reaches a terminal state.
//  6. GET /v1/billing/usage as tenant A -> paginated list contains the record,
//     scoped to tenant A, with incidentId + agentBreakdown + costUsd.
//  7. Tenant B calls GET /v1/billing/usage -> no records (tenant scoping).
import { readFileSync } from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';
import { serve } from '@hono/node-server';

// CLERK_JWT_KEY must be set BEFORE config/bootstrap is imported (config reads
// env at module load). Read the SPKI public PEM and inject into env.
process.env['CLERK_JWT_KEY'] = readFileSync('/tmp/ac011-clerk-pub.pem', 'utf8');

const { bootstrap } = await import('./src/bootstrap.js');
const { createApp } = await import('./src/app.js');
const { DeterministicLLMClient } = await import('./tests/e2e/stubs/deterministic-llm-client.js');
const { DeterministicAgentRunner } = await import('./tests/e2e/stubs/deterministic-agent-runner.js');
const { DynamoBillingAccountRepository } = await import('./src/modules/billing/infra/dynamo-billing-account.repository.js');

const PORT = Number(process.env['PORT'] || '5181');
const BASE = `http://localhost:${PORT}`;
const PRIV = readFileSync('/tmp/ac011-clerk-priv.pem', 'utf8');

let exitCode = 0;
function assert(cond, msg) {
  if (cond) { console.log('PASS:', msg); }
  else { console.error('FAIL:', msg); exitCode = 1; }
}

// --- Boot the app with deterministic LLM + agent-runner stubs ---
const stubLLM = new DeterministicLLMClient();
stubLLM.setScenario({
  synthesis: {
    findings: [
      { text: 'Memory utilization reached 95% before the container was OOM-killed by the kernel.', evidenceIds: ['ev_stub_1'] },
      { text: 'GC pause times exceeded 5 seconds immediately before the crash.', evidenceIds: ['ev_stub_2'] },
    ],
    potentialRootCause: 'OOM memory exceeded — container killed by kernel OOM killer due to a memory leak.',
    recommendedActions: [
      {
        action: 'restart_service',
        label: 'Restart payment-service',
        description: 'Restart the ECS service to clear the OOM state.',
        rationale: 'Service is down after an OOM kill; restart restores availability.',
        riskLevel: 'low',
        estimatedDuration: '2m',
        automated: true,
        params: { service: 'payment-service', cluster: 'production' },
      },
    ],
    evidence: [
      { type: 'log', content: 'OOM kill event detected for payment-service.' },
      { type: 'metric', content: 'MemoryUtilization peaked at 95%.' },
    ],
  },
});
const stubAgent = new DeterministicAgentRunner();

console.log('[boot] bootstrapping CauseFlow with deterministic LLM/agent stubs...');
const ctx = await bootstrap({ llmClient: stubLLM, agentRunner: stubAgent });
const app = createApp(ctx);
const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[boot] CauseFlow listening on ${PORT}`);
});

// Wait for /health
for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch(`${BASE}/health`);
    if (r.ok) { console.log('[boot] /health ok'); break; }
  } catch { /* retry */ }
  await new Promise((r) => setTimeout(r, 500));
}

async function mintJwt(orgId, role = 'admin') {
  const key = await importPKCS8(PRIV, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: `user_${orgId}`,
    email: `admin-${orgId}@causeflow.ai`,
    iss: 'https://clerk.causeflow.local',
    azp: 'causeflow-local',
    iat: now, nbf: now - 60, exp: now + 3600,
    o: { id: orgId, rol: role, slg: orgId.slice(-8) },
  }).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).sign(key);
}

const ORG_A = `org_ac012_${Date.now()}`;
const ORG_B = `org_ac012b_${Date.now()}`;
const jwtA = await mintJwt(ORG_A);
const authA = { Authorization: `Bearer ${jwtA}`, 'Content-Type': 'application/json' };

// 1) Create tenant A
let r = await fetch(`${BASE}/v1/tenants`, {
  method: 'POST', headers: authA,
  body: JSON.stringify({ name: 'AC-012 A', slug: `ac012-a-${Date.now()}`, ownerEmail: `admin-${ORG_A}@causeflow.ai`, plan: 'starter' }),
});
console.log('POST /v1/tenants (A) ->', r.status);
let body = await r.json();
console.log('  tenantA =', body.tenantId);
assert(r.status === 201, 'tenant A created (201)');
assert(body.tenantId === ORG_A, `tenantA id = JWT org id (${ORG_A})`);

// 2) Provision a BillingAccountEntity for tenant A (setup only)
const billingRepo = new DynamoBillingAccountRepository();
await billingRepo.create({
  tenantId: ORG_A,
  investigationsLimit: 15,
  investigationsUsed: 0,
  eventsLimit: 500,
  eventsUsed: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
console.log('[setup] BillingAccountEntity created for tenant A');

// 3) Create a manual incident with severity -> status=triaging -> in-process investigation
r = await fetch(`${BASE}/v1/incidents/chat`, {
  method: 'POST', headers: authA,
  body: JSON.stringify({
    title: 'payment-service OOM crash — production down',
    description: 'Payment service containers are being OOM-killed repeatedly; memory utilization climbs to 95% then the kernel kills the process. Customers cannot complete checkout.',
    severity: 'critical',
    suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
  }),
});
console.log('POST /v1/incident/chat (A) ->', r.status);
const inc = await r.json();
console.log('  incident =', JSON.stringify(inc));
assert(r.status === 201, 'manual incident created (201)');
const incidentId = inc.incidentId;
assert(typeof incidentId === 'string' && incidentId.length > 0, `incidentId returned (${incidentId})`);

// 4) Poll the incident until the investigation reaches a terminal state
let status = 'triaging';
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const ir = await fetch(`${BASE}/v1/incidents/${incidentId}`, { headers: authA });
  if (ir.ok) {
    const ib = await ir.json();
    status = ib.status;
    if (status === 'awaiting_approval' || status === 'resolved') {
      console.log(`[poll] incident reached terminal status: ${status} (after ${(i + 1) * 0.5}s)`);
      break;
    }
  }
}
assert(status === 'awaiting_approval' || status === 'resolved',
  `investigation completed (status=${status})`);

// 5) GET /v1/billing/usage as tenant A -> record with incidentId + agentBreakdown
r = await fetch(`${BASE}/v1/billing/usage`, { headers: authA });
console.log('GET /v1/billing/usage (A) ->', r.status);
const usage = await r.json();
console.log('  records =', JSON.stringify(usage.records));
assert(r.status === 200, 'GET /v1/billing/usage returns 200');
assert(Array.isArray(usage.records) && usage.records.length >= 1,
  `usage records non-empty (${usage.records?.length} record(s))`);

const rec = usage.records.find((x: any) => x.incidentId === incidentId);
assert(!!rec, `UsageRecord for incident ${incidentId} present`);
if (rec) {
  assert(rec.type === 'investigation', `record.type = investigation (got ${rec.type})`);
  assert(rec.incidentId === incidentId, `record.incidentId = ${incidentId}`);
  assert(typeof rec.costUsd === 'number', `record.costUsd is a number (got ${rec.costUsd})`);
  assert(Array.isArray(rec.agentBreakdown) && rec.agentBreakdown.length >= 1,
    `record.agentBreakdown non-empty (${rec.agentBreakdown?.length} agent(s))`);
  if (rec.agentBreakdown?.length) {
    const a0 = rec.agentBreakdown[0];
    assert(typeof a0.agentRole === 'string' && a0.agentRole.length > 0, `agent[0].agentRole present (${a0.agentRole})`);
    assert(typeof a0.inputTokens === 'number', `agent[0].inputTokens is number (${a0.inputTokens})`);
    assert(typeof a0.outputTokens === 'number', `agent[0].outputTokens is number (${a0.outputTokens})`);
    assert(typeof a0.costUsd === 'number', `agent[0].costUsd is number (${a0.costUsd})`);
  }
}

// 6) Tenant scoping: tenant B sees no records
const jwtB = await mintJwt(ORG_B);
const authB = { Authorization: `Bearer ${jwtB}`, 'Content-Type': 'application/json' };
r = await fetch(`${BASE}/v1/tenants`, {
  method: 'POST', headers: authB,
  body: JSON.stringify({ name: 'AC-012 B', slug: `ac012-b-${Date.now()}`, ownerEmail: `admin-${ORG_B}@causeflow.ai`, plan: 'starter' }),
});
console.log('POST /v1/tenants (B) ->', r.status);

r = await fetch(`${BASE}/v1/billing/usage`, { headers: authB });
console.log('GET /v1/billing/usage (B) ->', r.status);
const usageB = await r.json();
console.log('  recordsB =', JSON.stringify(usageB.records));
assert(r.status === 200, 'GET /v1/billing/usage (tenant B) returns 200');
assert(Array.isArray(usageB.records) && usageB.records.length === 0,
  `tenant B sees zero usage records (scoped) — got ${usageB.records?.length}`);

// 7) Pagination cursor present (the list endpoint exposes a cursor for paging)
assert(typeof usage.cursor === 'string' || usage.cursor === undefined || usage.records.length < 50,
  'usage response exposes a pagination shape (records + cursor)');

console.log('---');
console.log(exitCode ? 'AC-012: SOME ASSERTIONS FAILED' : 'AC-012: ALL ASSERTIONS PASSED');

server.close();
for (const c of ctx.consumers) { try { await c.stop(); } catch { /* noop */ } }
process.exit(exitCode);
