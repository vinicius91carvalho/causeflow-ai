/**
 * AC-046: Full local-only pipeline regression without SaaS credentials.
 *
 * Black-box HTTP test against a running host-dev stack (init.sh + docker-compose).
 * Mirrors `.harness/ac046-verify.sh`. Requires API and investigation worker on PORT.
 *
 * Run: PORT=3099 pnpm test:e2e tests/e2e/pipeline-local-only-regression.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';

const PORT = process.env['PORT'] ?? '3099';
// Avoid Vite/Vitest's built-in BASE_URL ("/") — it collapses to "" after trim.
const BASE_URL = (() => {
  const raw =
    process.env['E2E_BASE_URL'] ||
    process.env['CAUSEFLOW_BASE_URL'] ||
    `http://127.0.0.1:${PORT}`;
  return raw.replace(/\/$/, '') || `http://127.0.0.1:${PORT}`;
})();
const WEBHOOK_SECRET = (() => {
  if (process.env['WEBHOOK_SECRET_HOST']) return process.env['WEBHOOK_SECRET_HOST'];
  const fromEnv = process.env['WEBHOOK_SECRET'];
  if (fromEnv && fromEnv !== 'e2e-webhook-secret') return fromEnv;
  return 'oss-dev-webhook-secret';
})();
const HINDSIGHT_BASE = (() => {
  const raw =
    process.env['HINDSIGHT_BASE_URL_HOST'] ||
    process.env['HINDSIGHT_BASE_URL'] ||
    'http://127.0.0.1:8888';
  // Ignore Vite-style "/" and empty values.
  if (!raw || raw === '/') return 'http://127.0.0.1:8888';
  return raw.replace(/\/$/, '');
})();

const SAAS_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'LANGFUSE_PUBLIC_KEY',
  'LANGFUSE_SECRET_KEY',
  'LANGFUSE_BASE_URL',
  'SENTRY_DSN',
  'SVIX_API_KEY',
  'COMPOSIO_API_KEY',
  'MASTRA_API_KEY',
] as const;

const FOUNDATIONAL_AGENTS = [
  'log_analyst',
  'metric_analyst',
  'change_detector',
  'code_analyzer',
  'infra_inspector',
  'db_analyst',
] as const;

interface HealthBody {
  postgres?: string;
  redis?: string;
  queues?: string;
}

interface RegisterResponse {
  token?: string;
  tenant?: { id?: string };
  tenantId?: string;
}

interface WebhookResponse {
  status?: string;
  incidentId?: string;
  id?: string;
  deduplicated?: boolean;
  duplicate?: boolean;
}

interface InvestigationResponse {
  status?: string;
  incident?: { status?: string; severity?: string | null };
}

interface PipelineState {
  token: string;
  tenantId: string;
  incidentId: string;
  incidentIdDedup: string;
  sseText: string;
  severity: string;
  finalStatus: string;
  evidenceCount: number;
  evidenceAgentRoles: string[];
  hypothesisCount: number;
  hindsightRecall: string;
}

function signWebhook(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function extractTenantId(data: RegisterResponse): string {
  return data.tenantId ?? data.tenant?.id ?? '';
}

function extractIncidentId(data: WebhookResponse): string {
  return data.incidentId ?? data.id ?? '';
}

function countEvidence(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (!data || typeof data !== 'object') return 0;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record['evidence'])) return record['evidence'].length;
  const byAgent = record['evidenceByAgent'];
  if (byAgent && typeof byAgent === 'object') {
    return Object.values(byAgent as Record<string, unknown[]>).reduce(
      (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
      0,
    );
  }
  return 0;
}

function evidenceAgentRoles(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const byAgent = (data as Record<string, unknown>)['evidenceByAgent'];
  if (!byAgent || typeof byAgent !== 'object') return [];
  return Object.keys(byAgent as Record<string, unknown[]>).filter(Boolean);
}

function countHypotheses(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (!data || typeof data !== 'object') return 0;
  const record = data as Record<string, unknown>;
  const items = record['hypotheses'] ?? record['items'];
  return Array.isArray(items) ? items.length : 0;
}

function parseSseAgentRoles(text: string): Set<string> {
  const roles = new Set<string>();
  for (const block of text.split('\n\n')) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        const data = JSON.parse(raw) as { agentRole?: string };
        if (data.agentRole) roles.add(data.agentRole);
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }
  return roles;
}

async function probeHealth(): Promise<string | undefined> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) {
      return `GET /health returned ${res.status} at ${BASE_URL}`;
    }
    const body = (await res.json()) as HealthBody;
    if (body.postgres !== 'ok') return `postgres not ok in /health at ${BASE_URL}`;
    if (body.redis !== 'ok') return `redis not ok in /health at ${BASE_URL}`;
    if (body.queues !== 'ok') return `queues not ok in /health at ${BASE_URL}`;
    return undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `API not reachable at ${BASE_URL}/health (${message})`;
  }
}

async function collectSse(token: string, incidentId: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/investigation/${incidentId}/stream`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok || !res.body) {
    return '';
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  return text;
}

async function runPipeline(): Promise<PipelineState> {
  const stamp = Date.now();
  const email = `ac046-e2e-${stamp}@example.com`;
  const password = 'testpass123';
  const tenantName = `AC046 E2E ${stamp}`;
  const alertId = `dd-ac046-e2e-${stamp}`;

  const registerRes = await fetch(`${BASE_URL}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenantName }),
  });
  expect(registerRes.status).toBe(201);
  const registerBody = (await registerRes.json()) as RegisterResponse;
  const token = registerBody.token ?? '';
  const tenantId = extractTenantId(registerBody);
  expect(token).toBeTruthy();
  expect(tenantId).toBeTruthy();

  const alertPayload = {
    id: alertId,
    title: 'AC046 e2e pipeline regression high CPU order-service',
    body: 'Synthetic Datadog alert for AC-046 local-only pipeline. Database connection pool exhaustion suspected.',
    priority: 'P1',
    tags: ['service:order-service', 'env:local'],
    date: 1_710_000_000_000,
    org: { id: 1, name: 'ac046-e2e' },
    alert_type: 'error',
  };
  const webhookBody = JSON.stringify(alertPayload);
  const signature = signWebhook(webhookBody);
  const webhookHeaders = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
  };
  const webhookPath = `/v1/webhooks/${tenantId}/datadog`;

  const webhook1Res = await fetch(`${BASE_URL}${webhookPath}`, {
    method: 'POST',
    headers: webhookHeaders,
    body: webhookBody,
  });
  expect([200, 202]).toContain(webhook1Res.status);
  const webhook1Body = (await webhook1Res.json()) as WebhookResponse;
  const incidentId = extractIncidentId(webhook1Body);
  expect(incidentId).toBeTruthy();

  // Subscribe SSE immediately; give the stream a beat to connect before dedup POST.
  const sseAbort = new AbortController();
  const sseCollector = collectSse(token, incidentId, sseAbort.signal);
  await new Promise((r) => setTimeout(r, 500));

  const webhook2Res = await fetch(`${BASE_URL}${webhookPath}`, {
    method: 'POST',
    headers: webhookHeaders,
    body: webhookBody,
  });
  expect([200, 202]).toContain(webhook2Res.status);
  const webhook2Body = (await webhook2Res.json()) as WebhookResponse;
  const incidentIdDedup = extractIncidentId(webhook2Body);
  expect(incidentIdDedup).toBe(incidentId);

  let severity = '';
  let finalStatus = '';
  const pollDeadline = Date.now() + 480_000;

  while (Date.now() < pollDeadline) {
    const invRes = await fetch(`${BASE_URL}/api/v1/investigation/${incidentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (invRes.status === 429) {
      await new Promise((r) => setTimeout(r, 2_000));
      continue;
    }
    expect(invRes.ok).toBe(true);
    const invBody = (await invRes.json()) as InvestigationResponse;
    const sev = invBody.incident?.severity;
    if (sev && sev !== 'null') severity = sev;
    const status = invBody.status ?? '';
    const incidentStatus = invBody.incident?.status ?? '';
    if (
      status === 'succeeded' ||
      status === 'failed' ||
      incidentStatus === 'resolved' ||
      incidentStatus === 'failed' ||
      incidentStatus === 'awaiting_approval'
    ) {
      finalStatus = status || incidentStatus;
      break;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }

  expect(severity).toBeTruthy();

  // Persist + Hindsight writes can lag the terminal status by a few seconds.
  // Do not require 6 agent roles here — that burns the rate-limit window while
  // waiting for agents Ornith may still be finishing; the dedicated assertion
  // below checks foundational coverage via SSE + evidence.
  let evidenceJson: unknown = {};
  let hypothesesJson: unknown = {};
  let evidenceCount = 0;
  let hypothesisCount = 0;
  let roles: string[] = [];
  const artifactDeadline = Date.now() + 120_000;
  while (Date.now() < artifactDeadline) {
    const evidenceRes = await fetch(`${BASE_URL}/api/v1/investigation/${incidentId}/evidence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (evidenceRes.status === 429) {
      await new Promise((r) => setTimeout(r, 2_000));
      continue;
    }
    expect(evidenceRes.ok).toBe(true);
    evidenceJson = await evidenceRes.json();
    evidenceCount = countEvidence(evidenceJson);
    roles = evidenceAgentRoles(evidenceJson);

    const hypothesesRes = await fetch(
      `${BASE_URL}/api/v1/investigation/${incidentId}/hypotheses`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (hypothesesRes.status === 429) {
      await new Promise((r) => setTimeout(r, 2_000));
      continue;
    }
    expect(hypothesesRes.ok).toBe(true);
    hypothesesJson = await hypothesesRes.json();
    hypothesisCount = countHypotheses(hypothesesJson);

    if (evidenceCount >= 1 && hypothesisCount >= 1) break;
    await new Promise((r) => setTimeout(r, 2_000));
  }

  sseAbort.abort();
  const sseText = await sseCollector.catch(() => '');

  const bankId = `causeflow-${tenantId}`;
  let recallText = '';
  const recallDeadline = Date.now() + 60_000;
  while (Date.now() < recallDeadline) {
    const recallRes = await fetch(`${HINDSIGHT_BASE}/v1/default/banks/${bankId}/memories/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'AC046 e2e pipeline regression high CPU order-service root cause runbook',
        budget: 'mid',
      }),
    });
    recallText = recallRes.ok ? await recallRes.text() : '';
    if (
      /root cause|investigation|AC046|order-service|Unable to determine|runbook|Findings/i.test(
        recallText,
      )
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  return {
    token,
    tenantId,
    incidentId,
    incidentIdDedup,
    sseText,
    severity,
    finalStatus,
    evidenceCount,
    evidenceAgentRoles: roles,
    hypothesisCount,
    hindsightRecall: recallText,
  };
}

describe('E2E Pipeline: local-only regression (AC-046)', () => {
  let state: PipelineState | undefined;
  let skipReason: string | undefined;
  const savedEnv = new Map<string, string | undefined>();

  beforeAll(async () => {
    for (const key of SAAS_ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env['ANTHROPIC_API_KEY'] = '';

    skipReason = await probeHealth();
    if (skipReason) {
      console.warn(`[AC-046] Skipping black-box pipeline: ${skipReason}`);
      return;
    }

    state = await runPipeline();
  }, 600_000);

  afterAll(() => {
    for (const [key, val] of savedEnv) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it('requires a healthy local-only API at BASE_URL', async () => {
    if (skipReason) {
      throw new Error(`AC-046 black-box requires running API: ${skipReason}`);
    }
    expect(state).toBeDefined();
  });

  it('deduplicates identical Datadog webhooks within the dedup window', async () => {
    if (skipReason) throw new Error(skipReason);
    expect(state!.incidentIdDedup).toBe(state!.incidentId);
  });

  it('sets incident severity via triage without Anthropic credentials', async () => {
    if (skipReason) throw new Error(skipReason);
    expect(state!.severity).toBeTruthy();
  });

  it('runs six or more agents with SSE or evidence proof', async () => {
    if (skipReason) throw new Error(skipReason);
    const sseRoles = parseSseAgentRoles(state!.sseText);
    const evidenceRoles = new Set(state!.evidenceAgentRoles);
    const combined = new Set([...sseRoles, ...evidenceRoles]);

    expect(combined.size).toBeGreaterThanOrEqual(6);
    for (const role of FOUNDATIONAL_AGENTS) {
      expect(combined.has(role)).toBe(true);
    }
  });

  it('completes investigation with terminal status', async () => {
    if (skipReason) throw new Error(skipReason);
    expect(['succeeded', 'failed', 'resolved', 'awaiting_approval']).toContain(state!.finalStatus);
  });

  it('persists evidence and hypotheses retrievable via API', async () => {
    if (skipReason) throw new Error(skipReason);
    expect(state!.evidenceCount).toBeGreaterThanOrEqual(1);
    expect(state!.hypothesisCount).toBeGreaterThanOrEqual(1);
  });

  it('writes runbook content to the local Hindsight bank', async () => {
    if (skipReason) throw new Error(skipReason);
    expect(state!.hindsightRecall).toMatch(
      /root cause|investigation|AC046|order-service|Unable to determine|runbook|Findings/i,
    );
  });
});
