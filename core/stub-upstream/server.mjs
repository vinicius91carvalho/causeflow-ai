#!/usr/bin/env node
/**
 * CauseFlow OSS stub upstream — webhook simulator (AC-056).
 *
 * Standalone HTTP service that dashboard E2E and Core connect/probe flows hit
 * without Composio or paid SaaS. Deterministic in-memory state is exposed at
 * GET /v1/state for black-box verification.
 *
 * Usage:
 *   STUB_UPSTREAM_PORT=5190 node stub-upstream/server.mjs
 */
import http from 'node:http';
import crypto from 'node:crypto';

const port = Number(process.env['STUB_UPSTREAM_PORT'] ?? 5190);
const host = process.env['STUB_UPSTREAM_HOST'] ?? '127.0.0.1';

/** @type {Map<string, { connectionId: string, coreBaseUrl: string, connectedAt: string }>} */
const connections = new Map();

const metrics = {
  probeCount: 0,
  ingestCount: 0,
  lastProbeAt: null,
  lastIngestAt: null,
  lastEmitResult: null,
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
    connectionCount: connections.size,
    connections: [...connections.entries()].map(([tenantId, c]) => ({
      tenantId,
      connectionId: c.connectionId,
      coreBaseUrl: c.coreBaseUrl,
      connectedAt: c.connectedAt,
    })),
    probeCount: metrics.probeCount,
    ingestCount: metrics.ingestCount,
    lastProbeAt: metrics.lastProbeAt,
    lastIngestAt: metrics.lastIngestAt,
    lastEmitResult: metrics.lastEmitResult,
  };
}

function signWebhook(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { status: 'ok', service: 'causeflow-stub-upstream' });
  }

  if (req.method === 'GET' && url.pathname === '/v1/state') {
    return json(res, 200, snapshotState());
  }

  if (req.method === 'POST' && url.pathname === '/v1/connect') {
    const body = await readBody(req);
    const tenantId = String(body.tenantId ?? '');
    const coreBaseUrl = String(body.coreBaseUrl ?? '');
    if (!tenantId || !coreBaseUrl) {
      return json(res, 400, { error: 'tenantId and coreBaseUrl are required' });
    }
    const connectionId = `stub-conn-${tenantId}-${Date.now()}`;
    connections.set(tenantId, {
      connectionId,
      coreBaseUrl: coreBaseUrl.replace(/\/$/, ''),
      connectedAt: new Date().toISOString(),
    });
    console.log(`[stub-upstream] connect tenantId=${tenantId} connectionId=${connectionId}`);
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
      tenantId,
      metric: 'cpu.utilization',
      value: 92.5,
      service: 'order-service',
      message: 'Deterministic stub probe evidence for OSS connector verification',
    };
    console.log(`[stub-upstream] probe tenantId=${tenantId} probeCount=${metrics.probeCount}`);
    return json(res, 200, {
      ok: true,
      probeCount: metrics.probeCount,
      evidence,
      state: snapshotState(),
    });
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

    const alertId = `stub-alert-${Date.now()}`;
    const payload = {
      id: alertId,
      title: body.title ?? 'Stub upstream alert',
      body: body.description ?? 'Alert emitted by stub upstream',
      priority: body.priority ?? 'P2',
      tags: ['service:order-service', 'env:local', 'source:stub-upstream'],
      date: Date.now(),
      org: { id: 1, name: 'stub-upstream' },
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
    console.log(`[stub-upstream] ingest tenantId=${tenantId} incidentId=${incidentId} ingestCount=${metrics.ingestCount}`);

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

server.listen(port, host, () => {
  console.log(`[stub-upstream] listening on http://${host}:${port}`);
});
