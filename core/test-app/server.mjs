#!/usr/bin/env node
/**
 * CauseFlow OSS runnable test application (AC-058).
 *
 * Documented HTTP service the dashboard connects as an integration target.
 * Emits signed webhooks into Core ingest and answers probe/tool calls with
 * deterministic evidence for investigation golden-path E2E (web AC-058/AC-060).
 *
 * Usage:
 *   TEST_APP_PORT=5190 node test-app/server.mjs
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const port = Number(process.env['TEST_APP_PORT'] ?? process.env['STUB_UPSTREAM_PORT'] ?? 5190);
const host = process.env['TEST_APP_HOST'] ?? process.env['STUB_UPSTREAM_HOST'] ?? '127.0.0.1';

/** @type {Map<string, { connectionId: string, coreBaseUrl: string, connectedAt: string }>} */
const connections = new Map();

const metrics = {
  probeCount: 0,
  ingestCount: 0,
  toolCallCount: 0,
  lastProbeAt: null,
  lastIngestAt: null,
  lastToolCallAt: null,
  lastEmitResult: null,
};

/** Deterministic investigation tool handlers (AC-058). */
const TOOL_HANDLERS = {
  query_logs: (input) => ({
    logs: [
      {
        timestamp: '2026-07-11T08:00:01.000Z',
        level: 'error',
        service: String(input.service ?? 'order-service'),
        message: 'Connection pool exhausted — max 20 connections, 20 in use',
      },
      {
        timestamp: '2026-07-11T08:00:02.100Z',
        level: 'error',
        service: String(input.service ?? 'order-service'),
        message: 'Upstream timeout calling payment-service after 5000ms',
      },
    ],
    evidence: {
      source: 'causeflow-test-app',
      tool: 'query_logs',
      finding: 'Repeated connection pool exhaustion errors on order-service',
      service: String(input.service ?? 'order-service'),
    },
  }),
  query_metrics: (input) => ({
    metrics: [
      { name: 'cpu.utilization', value: 92.5, unit: 'percent', service: String(input.service ?? 'order-service') },
      { name: 'http.latency.p99', value: 4820, unit: 'ms', service: String(input.service ?? 'order-service') },
      { name: 'db.connections.active', value: 20, unit: 'count', service: String(input.service ?? 'order-service') },
    ],
    evidence: {
      source: 'causeflow-test-app',
      tool: 'query_metrics',
      finding: 'CPU and p99 latency elevated; DB connection pool saturated',
      service: String(input.service ?? 'order-service'),
    },
  }),
  get_deployments: () => ({
    deployments: [
      {
        id: 'deploy-ac058-001',
        service: 'order-service',
        version: 'v2.4.1-ac058',
        deployedAt: '2026-07-11T07:55:00.000Z',
        status: 'completed',
      },
    ],
    evidence: {
      source: 'causeflow-test-app',
      tool: 'get_deployments',
      finding: 'Deploy v2.4.1-ac058 to order-service 5 minutes before alert onset',
      service: 'order-service',
    },
  }),
  get_service_health: (input) => ({
    service: String(input.service ?? 'order-service'),
    status: 'degraded',
    checks: [
      { name: 'db_pool', status: 'failing', detail: 'pool exhausted' },
      { name: 'upstream_payment', status: 'degraded', detail: 'elevated latency' },
    ],
    evidence: {
      source: 'causeflow-test-app',
      tool: 'get_service_health',
      finding: 'order-service health degraded — DB pool failing',
      service: String(input.service ?? 'order-service'),
    },
  }),
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function snapshotState() {
  return {
    app: 'causeflow-test-app',
    connectionCount: connections.size,
    connections: [...connections.entries()].map(([tenantId, c]) => ({
      tenantId,
      connectionId: c.connectionId,
      coreBaseUrl: c.coreBaseUrl,
      connectedAt: c.connectedAt,
    })),
    probeCount: metrics.probeCount,
    ingestCount: metrics.ingestCount,
    toolCallCount: metrics.toolCallCount,
    lastProbeAt: metrics.lastProbeAt,
    lastIngestAt: metrics.lastIngestAt,
    lastToolCallAt: metrics.lastToolCallAt,
    lastEmitResult: metrics.lastEmitResult,
    availableTools: Object.keys(TOOL_HANDLERS),
  };
}

function signWebhook(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function handleToolCall(tool, input) {
  const handler = TOOL_HANDLERS[tool];
  if (!handler) {
    return { ok: false, error: `unknown tool: ${tool}`, availableTools: Object.keys(TOOL_HANDLERS) };
  }
  const result = handler(input ?? {});
  return { ok: true, tool, output: result, evidence: result.evidence };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { status: 'ok', service: 'causeflow-test-app', app: 'causeflow-test-app' });
  }

  if (req.method === 'GET' && url.pathname === '/v1/state') {
    return json(res, 200, snapshotState());
  }

  if (req.method === 'GET' && url.pathname === '/v1/tools') {
    return json(res, 200, {
      app: 'causeflow-test-app',
      tools: Object.keys(TOOL_HANDLERS).map((name) => ({
        name,
        description: `Deterministic ${name} evidence for OSS investigation`,
      })),
    });
  }

  if (req.method === 'POST' && url.pathname === '/v1/connect') {
    const body = await readBody(req);
    const tenantId = String(body.tenantId ?? '');
    const coreBaseUrl = String(body.coreBaseUrl ?? '');
    if (!tenantId || !coreBaseUrl) {
      return json(res, 400, { error: 'tenantId and coreBaseUrl are required' });
    }
    const connectionId = `test-app-conn-${tenantId}-${Date.now()}`;
    connections.set(tenantId, {
      connectionId,
      coreBaseUrl: coreBaseUrl.replace(/\/$/, ''),
      connectedAt: new Date().toISOString(),
    });
    console.log(`[test-app] connect tenantId=${tenantId} connectionId=${connectionId}`);
    return json(res, 201, { connectionId, status: 'connected', state: snapshotState() });
  }

  if (req.method === 'POST' && url.pathname === '/v1/probe') {
    const body = await readBody(req);
    const tenantId = String(body.tenantId ?? '');
    if (!tenantId || !connections.has(tenantId)) {
      return json(res, 404, { error: 'tenant not connected' });
    }
    metrics.probeCount += 1;
    metrics.lastProbeAt = new Date().toISOString();
    const evidence = {
      source: 'stub-upstream',
      app: 'causeflow-test-app',
      tenantId,
      metric: 'cpu.utilization',
      value: 92.5,
      service: 'order-service',
      message: 'Deterministic test-app probe evidence for OSS connector verification',
    };
    console.log(`[test-app] probe tenantId=${tenantId} probeCount=${metrics.probeCount}`);
    return json(res, 200, {
      ok: true,
      probeCount: metrics.probeCount,
      evidence,
      state: snapshotState(),
    });
  }

  if (req.method === 'POST' && url.pathname === '/v1/tools/call') {
    const body = await readBody(req);
    const tenantId = String(body.tenantId ?? '');
    const tool = String(body.tool ?? body.name ?? '');
    const input = body.input ?? body.params ?? {};
    if (!tenantId || !connections.has(tenantId)) {
      return json(res, 404, { error: 'tenant not connected' });
    }
    if (!tool) {
      return json(res, 400, { error: 'tool is required' });
    }
    const result = handleToolCall(tool, input);
    if (!result.ok) {
      return json(res, 400, result);
    }
    metrics.toolCallCount += 1;
    metrics.lastToolCallAt = new Date().toISOString();
    console.log(`[test-app] tool_call tenantId=${tenantId} tool=${tool} count=${metrics.toolCallCount}`);
    return json(res, 200, { ...result, state: snapshotState() });
  }

  if (req.method === 'POST' && url.pathname === '/v1/alerts/emit') {
    const body = await readBody(req);
    const tenantId = String(body.tenantId ?? '');
    const coreBaseUrl = String(body.coreBaseUrl ?? connections.get(tenantId)?.coreBaseUrl ?? '');
    const webhookSecret = String(body.webhookSecret ?? '');
    if (!tenantId || !coreBaseUrl || !webhookSecret) {
      return json(res, 400, { error: 'tenantId, coreBaseUrl, and webhookSecret are required' });
    }
    if (!connections.has(tenantId)) {
      return json(res, 404, { error: 'tenant not connected' });
    }

    const alertId = `test-app-alert-${Date.now()}`;
    const payload = {
      id: alertId,
      title: body.title ?? 'Test application alert',
      body: body.description ?? 'Alert emitted by causeflow-test-app',
      priority: body.priority ?? 'P2',
      tags: ['service:order-service', 'env:local', 'source:causeflow-test-app'],
      date: Date.now(),
      org: { id: 1, name: 'causeflow-test-app' },
      alert_type: 'error',
    };
    const payloadStr = JSON.stringify(payload);
    const signature = signWebhook(webhookSecret, payloadStr);
    const webhookUrl = `${coreBaseUrl.replace(/\/$/, '')}/v1/webhooks/${tenantId}/datadog`;

    let incidentId;
    let webhookStatus = 0;
    try {
      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(15_000),
      });
      webhookStatus = whRes.status;
      const whBody = await whRes.json().catch(() => ({}));
      incidentId = whBody.incidentId ?? whBody.id;
      if (!whRes.ok) {
        metrics.lastEmitResult = { ok: false, webhookStatus, webhookUrl, body: whBody };
        return json(res, 502, {
          error: `Core webhook returned HTTP ${whRes.status}`,
          state: snapshotState(),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      metrics.lastEmitResult = { ok: false, error: message, webhookUrl };
      return json(res, 502, { error: `Failed to emit webhook: ${message}`, state: snapshotState() });
    }

    metrics.ingestCount += 1;
    metrics.lastIngestAt = new Date().toISOString();
    metrics.lastEmitResult = { ok: true, webhookStatus, webhookUrl, incidentId, alertId };
    console.log(`[test-app] ingest tenantId=${tenantId} incidentId=${incidentId} ingestCount=${metrics.ingestCount}`);

    return json(res, 202, {
      emitted: true,
      incidentId,
      alertId,
      webhookStatus,
      state: snapshotState(),
    });
  }

  json(res, 404, { error: 'not found' });
});

export function startTestApp(options = {}) {
  const listenPort = Number(options.port ?? port);
  const listenHost = options.host ?? host;
  return new Promise((resolve) => {
    server.listen(listenPort, listenHost, () => {
      console.log(`[test-app] listening on http://${listenHost}:${listenPort}`);
      resolve(server);
    });
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  startTestApp();
}
