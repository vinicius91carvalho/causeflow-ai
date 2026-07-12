import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock Sentry captureException so we can assert it was called with the Error instance
const mockCaptureException = vi.fn();
vi.mock('../../../../src/shared/infra/observability/sentry.js', () => ({
  captureException: (...args: unknown[]): void => {
    mockCaptureException(...args);
  },
}));

const mockRedriveDLQ = vi.fn();
vi.mock('../../../../src/shared/infra/queue/dlq-redriver.js', () => ({
  redriveDLQ: (...args: unknown[]) => mockRedriveDLQ(...args) as unknown,
}));

const mockConfig = vi.hoisted(() => ({
  sqs: {
    alertQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123/alerts',
    investigationQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123/investigation',
    remediationQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123/remediation',
    alertDlqUrl: 'https://sqs.us-east-1.amazonaws.com/123/alerts-dlq',
    investigationDlqUrl: 'https://sqs.us-east-1.amazonaws.com/123/investigation-dlq',
    remediationDlqUrl: 'https://sqs.us-east-1.amazonaws.com/123/remediation-dlq',
  },
  env: 'test',
  stage: 'staging',
  isDev: () => false,
  isProd: () => false,
  isTest: () => true,
  logLevel: 'silent',
  rateLimit: { windowSeconds: 60, plans: {}, default: 100 },
}));

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: mockConfig,
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createAdminRoutes } from '../../../../src/modules/ingestion/infra/admin.routes.js';
import { TestErrorFiredError } from '../../../../src/shared/domain/errors.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { IngestAlertUseCase } from '../../../../src/modules/ingestion/application/ingest-alert.usecase.js';
import type { CreateManualIncidentUseCase } from '../../../../src/modules/ingestion/application/create-manual-incident.usecase.js';

const mockIncidentRepo = { findAll: vi.fn() } as unknown as IIncidentRepository;
const mockIngestAlertExecute = vi.fn();
const mockIngestAlert = { execute: mockIngestAlertExecute } as unknown as IngestAlertUseCase;
const mockCreateManualIncident = { execute: vi.fn() } as unknown as CreateManualIncidentUseCase;
const adminDeps = {
  incidentRepo: mockIncidentRepo,
  ingestAlert: mockIngestAlert,
  createManualIncident: mockCreateManualIncident,
};
const app = createTestApp(() => createAdminRoutes(adminDeps), {} as any, { userRoles: ['admin'] });

describe('admin.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedriveDLQ.mockResolvedValue({ moved: 3, failed: 0 });
    mockConfig.stage = 'staging';
  });

  it('POST /test/queues/redrive with valid queue returns 200', async () => {
    const res = await app.request('/test/queues/redrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: 'alerts', limit: 5 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ moved: 3, failed: 0 });
    expect(mockRedriveDLQ).toHaveBeenCalledWith(
      'https://sqs.us-east-1.amazonaws.com/123/alerts-dlq',
      'https://sqs.us-east-1.amazonaws.com/123/alerts',
      5,
    );
  });

  it('POST /test/queues/redrive with investigation queue', async () => {
    const res = await app.request('/test/queues/redrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: 'investigation' }),
    });

    expect(res.status).toBe(200);
    expect(mockRedriveDLQ).toHaveBeenCalledWith(
      'https://sqs.us-east-1.amazonaws.com/123/investigation-dlq',
      'https://sqs.us-east-1.amazonaws.com/123/investigation',
      10,
    );
  });

  it('POST /test/queues/redrive with invalid queue returns 400', async () => {
    const res = await app.request('/test/queues/redrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: 'invalid' }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /test/queues/redrive without body returns 400', async () => {
    const res = await app.request('/test/queues/redrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('POST /test/queues/redrive with non-admin role returns 403', async () => {
    const nonAdminApp = createTestApp(() => createAdminRoutes(adminDeps), {} as any, {
      userRoles: ['viewer'],
    });
    const res = await nonAdminApp.request('/test/queues/redrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: 'alerts' }),
    });

    expect(res.status).toBe(403);
  });

  describe('POST /fire-test-errors — AD-7 throw contract', () => {
    it('returns 500 with { error: "TestErrorFired", traceId } on staging (AD-7)', async () => {
      const res = await app.request('/test/fire-test-errors', { method: 'POST' });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; traceId: string };
      expect(body.error).toBe('TestErrorFired');
      // traceId sourced from requestId middleware (injected by test helper)
      expect(typeof body.traceId).toBe('string');
      expect(body.traceId).toBe('test-request-id-001');
    });

    it('response body has NO extra fields beyond error and traceId', async () => {
      const res = await app.request('/test/fire-test-errors', { method: 'POST' });
      const body = (await res.json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['error', 'traceId'].sort());
    });

    it('Sentry captureException is called with the TestErrorFiredError instance', async () => {
      await app.request('/test/fire-test-errors', { method: 'POST' });

      expect(mockCaptureException).toHaveBeenCalledTimes(1);
      const [capturedError] = mockCaptureException.mock.calls[0] as [unknown];
      expect(capturedError).toBeInstanceOf(TestErrorFiredError);
      expect(capturedError).toBeInstanceOf(Error);
    });

    it('returns 403 on production stage — non-prod gate holds', async () => {
      mockConfig.stage = 'production';

      const res = await app.request('/test/fire-test-errors', { method: 'POST' });

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Not available in production');
    });

    it('returns 403 for non-admin role', async () => {
      const nonAdminApp = createTestApp(() => createAdminRoutes(adminDeps), {} as any, {
        userRoles: ['viewer'],
      });

      const res = await nonAdminApp.request('/test/fire-test-errors', { method: 'POST' });

      expect(res.status).toBe(403);
    });

    it('returns 500 on non-production stage (development)', async () => {
      mockConfig.stage = 'development';

      const res = await app.request('/test/fire-test-errors', { method: 'POST' });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; traceId: string };
      expect(body.error).toBe('TestErrorFired');
    });
  });
});
