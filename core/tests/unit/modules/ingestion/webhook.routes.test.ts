import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../src/shared/infra/http/middleware/webhook-auth.middleware.js', () => ({
  webhookAuth: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

// Mock sentry auth middleware so route tests can verify markVerified/markEventReceived without real HMAC
vi.mock('../../../../src/modules/integration/infra/middleware/sentry-webhook-auth.middleware.js', () => ({
  createSentryWebhookAuth: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: { webhook: { secret: 'test-secret' } },
}));

import { Hono } from 'hono';
import { createWebhookRoutes, type WebhookUseCases } from '../../../../src/modules/ingestion/infra/webhook.routes.js';

const mockIngestAlert = { execute: vi.fn().mockResolvedValue({ incidentId: 'inc-1' }) };

const mockUseCases = {
  ingestAlert: mockIngestAlert,
};

const app = new Hono();
app.route('/webhooks', createWebhookRoutes(mockUseCases as unknown as WebhookUseCases));

describe('webhook.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIngestAlert.execute.mockResolvedValue({ incidentId: 'inc-1' });
  });

  it('POST /webhooks/:tenantId/:provider with valid payload returns 202', async () => {
    const res = await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'alert-123',
        title: 'High CPU Usage',
        severity: 'critical',
      }),
    });

    expect(res.status).toBe(202);
    expect(mockIngestAlert.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('status', 'accepted');
    expect(body).toHaveProperty('incidentId', 'inc-1');
  });

  it('POST /webhooks/:tenantId/unknown_provider still returns 202', async () => {
    const res = await app.request('/webhooks/tenant-1/unknown_provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'alert-456', message: 'Something broke' }),
    });

    expect(res.status).toBe(202);
    expect(mockIngestAlert.execute).toHaveBeenCalledOnce();
  });

  it('POST /webhooks/:tenantId/datadog with empty body fails naturally', async () => {
    const res = await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Still accepted — empty payload is valid JSON, parser handles extraction
    expect(res.status).toBe(202);
  });
});

// ─── Sentry-specific route behavior tests ───────────────────────────────────

describe('webhook.routes — Sentry route calls markVerified + markEventReceived', () => {
  const markVerified = vi.fn().mockResolvedValue(undefined);
  const markEventReceived = vi.fn().mockResolvedValue(undefined);
  const sentryIngestAlert = vi.fn().mockResolvedValue({ incidentId: 'inc-sentry-1' });

  const sentryRepo = {
    findSentryClientSecret: vi.fn().mockResolvedValue('some-secret'),
    setClientSecret: vi.fn().mockResolvedValue(undefined),
    markVerified,
    markEventReceived,
    getSentryStatus: vi.fn().mockResolvedValue({ configured: true, verified: false, verifiedAt: null, lastEventAt: null }),
  };

  const sentryUseCases: WebhookUseCases = {
    ingestAlert: { execute: sentryIngestAlert } as unknown as WebhookUseCases['ingestAlert'],
    sentryIntegrationRepo: sentryRepo,
  };

  const sentryApp = new Hono();
  sentryApp.route('/webhooks', createWebhookRoutes(sentryUseCases));

  beforeEach(() => {
    vi.clearAllMocks();
    sentryIngestAlert.mockResolvedValue({ incidentId: 'inc-sentry-1' });
  });

  it('calls markEventReceived and markVerified on every valid sentry webhook hit', async () => {
    const res = await sentryApp.request('/webhooks/tenant-1/sentry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'triggered', data: { issue: { id: 'issue-001' } } }),
    });

    expect(res.status).toBe(202);
    expect(markEventReceived).toHaveBeenCalledOnce();
    expect(markEventReceived).toHaveBeenCalledWith('tenant-1');
    expect(markVerified).toHaveBeenCalledOnce();
    expect(markVerified).toHaveBeenCalledWith('tenant-1');
  });

  it('calls markEventReceived on every subsequent valid sentry hit (lastEventAt updated each time)', async () => {
    await sentryApp.request('/webhooks/tenant-1/sentry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'triggered', data: { issue: { id: 'issue-001' } } }),
    });
    await sentryApp.request('/webhooks/tenant-1/sentry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'triggered', data: { issue: { id: 'issue-002' } } }),
    });

    expect(markEventReceived).toHaveBeenCalledTimes(2);
    expect(markVerified).toHaveBeenCalledTimes(2);
  });

  it('returns 202 with sentry-specific fields for sentry route', async () => {
    const res = await sentryApp.request('/webhooks/tenant-1/sentry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'triggered', data: { issue: { id: 'issue-003' } } }),
    });

    expect(res.status).toBe(202);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('accepted');
    expect(body.provider).toBe('sentry');
    expect(body.incidentId).toBe('inc-sentry-1');
  });
});
