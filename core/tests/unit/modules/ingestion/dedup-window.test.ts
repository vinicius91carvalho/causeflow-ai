/**
 * AC-015: Dedup window for identical Datadog payloads.
 *
 * POST the same Datadog payload twice within the dedup window; only one
 * IncidentEntity is created (the second call returns the existing incident
 * ID and does not enqueue a duplicate triage message). After the dedup
 * window elapses, a third identical POST creates a new incident.
 *
 * This test exercises the dedup logic at the HTTP boundary through the real
 * webhook routes. The webhook-auth and sentry-auth middlewares are mocked
 * (pass-through) so we can focus on the dedup protocol. The config module
 * is mocked to use a 1-second dedup window, and vi.useFakeTimers controls
 * the passage of time deterministically.
 */

// ---- Mocks must be hoisted before any imports ----
import { vi } from 'vitest';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    webhook: { secret: 'test-secret' },
    ingestion: {
      // 1 second = 0.0166667 minutes — short enough for fast tests,
      // long enough to fit two POSTs made back-to-back.
      dedupWindowMinutes: 0.0166667,
    },
    anthropic: { apiKey: '' },
    isOss: () => true,
  },
}));

vi.mock('../../../../src/shared/infra/http/middleware/webhook-auth.middleware.js', () => ({
  webhookAuth: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock(
  '../../../../src/modules/integration/infra/middleware/sentry-webhook-auth.middleware.js',
  () => ({
    createSentryWebhookAuth: () => async (_c: unknown, next: () => Promise<void>) => next(),
  }),
);

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  createWebhookRoutes,
  type WebhookUseCases,
} from '../../../../src/modules/ingestion/infra/webhook.routes.js';
import { IngestAlertUseCase } from '../../../../src/modules/ingestion/application/ingest-alert.usecase.js';
import { ProviderRegistry } from '../../../../src/shared/application/provider-registry.js';
import { DatadogParser } from '../../../../src/modules/ingestion/infra/parsers/datadog.parser.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { MessageQueue } from '../../../../src/shared/application/ports/message-queue.port.js';

// Tell vitest we'll use fake timers
vi.useFakeTimers();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRepo(): IIncidentRepository {
  // In-memory store so findBySourceAlert actually works across calls
  const store = new Map<string, Incident>();
  let callCount = 0;

  return {
    create: vi.fn(async (incident: Incident) => {
      callCount++;
      const key = `${incident.tenantId}:${incident.incidentId}`;
      store.set(key, incident);
      return incident;
    }),
    findById: vi.fn(async (_tid, id) => {
      for (const incident of store.values()) {
        if (incident.incidentId === id) return incident;
      }
      return null;
    }),
    findBySourceAlert: vi.fn(async (tid, sourceProvider, sourceAlertId) => {
      for (const incident of store.values()) {
        if (
          incident.tenantId === tid &&
          incident.sourceProvider === sourceProvider &&
          incident.sourceAlertId === sourceAlertId
        ) {
          return incident;
        }
      }
      return null;
    }),
    update: vi.fn(),
    updateStatus: vi.fn(),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
    // Expose call count for assertions
    _createCallCount: () => callCount,
  } as IIncidentRepository & { _createCallCount: () => number };
}

function createMockMessageQueue(): MessageQueue {
  return {
    send: vi.fn(async () => {}),
  };
}

// ---------------------------------------------------------------------------
// A Datadog alert that stays the same across identical POSTs
// ---------------------------------------------------------------------------
const DATADOG_PAYLOAD = {
  id: 'datadog-alert-dedup-window-001',
  alert_type: 'error',
  title: 'CPU Usage Critical – Dedup Window Test',
  body: 'CPU at 97% on production box for more than 5 minutes',
  tags: ['env:production', 'service:api'],
};

// A different Datadog alert (different id → different sourceAlertId)
const DATADOG_PAYLOAD_2 = {
  id: 'datadog-alert-dedup-window-002',
  alert_type: 'warning',
  title: 'Memory Usage Elevated',
  body: 'Memory at 82%',
  tags: ['env:production', 'service:db'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AC-015: Dedup window for identical Datadog payloads (HTTP boundary)', () => {
  let repo: IIncidentRepository;
  let eventBus: EventBus;
  let registry: ProviderRegistry;
  let messageQueue: MessageQueue;
  let app: Hono;

  beforeEach(() => {
    repo = createMockRepo();
    eventBus = new EventBus();
    registry = new ProviderRegistry();
    messageQueue = createMockMessageQueue();

    registry.registerAlertParser('datadog', new DatadogParser());

    const ingestAlert = new IngestAlertUseCase(
      repo,
      eventBus,
      registry,
      messageQueue,
      'http://localhost:4566/queue/alerts',
    );

    const useCases: WebhookUseCases = {
      ingestAlert: ingestAlert as unknown as WebhookUseCases['ingestAlert'],
    };

    app = new Hono();
    app.route('/webhooks', createWebhookRoutes(useCases as unknown as WebhookUseCases));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Scenario 1: Two identical POSTs within the dedup window ────────────

  it('POST same Datadog payload twice within window — second returns existing incident and no duplicate enqueue', async () => {
    // Freeze time at a known anchor
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    // 1) First POST — creates the incident
    const res1 = await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD),
    });
    expect(res1.status).toBe(202);
    const body1 = (await res1.json()) as Record<string, unknown>;
    expect(body1['status']).toBe('accepted');
    expect(body1['provider']).toBe('datadog');
    const firstId = body1['incidentId'] as string;
    expect(firstId).toBeTruthy();

    // 2) Second POST — 300ms later, well within the 1 000 ms window
    vi.advanceTimersByTime(300);
    const res2 = await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD),
    });
    expect(res2.status).toBe(202);
    const body2 = (await res2.json()) as Record<string, unknown>;
    expect(body2['incidentId']).toBe(firstId);

    // 3) Only one incident was created (the second call hit the dedup path)
    expect(repo.create).toHaveBeenCalledTimes(1);

    // 4) Only one triage message was enqueued (no duplicate)
    expect(messageQueue.send).toHaveBeenCalledTimes(1);
  });

  // ── Scenario 2: After the dedup window elapses, a new incident is created ─

  it('POST same payload after window elapses — creates a new incident', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    // 1) First POST
    const res1 = await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD),
    });
    expect(res1.status).toBe(202);
    const body1 = (await res1.json()) as Record<string, unknown>;
    const firstId = body1['incidentId'] as string;

    // 2) Advance time past the 1 000 ms dedup window
    vi.advanceTimersByTime(1500);

    // 3) Third POST with the exact same payload
    const res3 = await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD),
    });
    expect(res3.status).toBe(202);
    const body3 = (await res3.json()) as Record<string, unknown>;
    const thirdId = body3['incidentId'] as string;

    // 4) A new incident was created (different ID)
    expect(thirdId).not.toBe(firstId);

    // 5) Two incidents created total
    expect(repo.create).toHaveBeenCalledTimes(2);

    // 6) Two triage messages enqueued
    expect(messageQueue.send).toHaveBeenCalledTimes(2);
  });

  // ── Scenario 3: Only one incident.created event is emitted ─────────────

  it('does not emit duplicate incident.created events for deduplicated alerts', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const createdEvents: Array<Record<string, unknown>> = [];
    eventBus.subscribe('incident.created', (e) => {
      createdEvents.push(e as unknown as Record<string, unknown>);
    });

    // 1) First POST
    await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD),
    });

    // 2) Second POST within window
    vi.advanceTimersByTime(300);
    await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD),
    });

    // 3) Only one incident.created for the dedup-test title
    const relevant = createdEvents.filter(
      (e) =>
        e.payload &&
        (e.payload as Record<string, unknown>)['title'] ===
          'CPU Usage Critical – Dedup Window Test',
    );
    expect(relevant.length).toBe(1);
  });

  // ── Scenario 4: Different Datadog alerts are not deduplicated ──────────

  it('different Datadog alert IDs produce separate incidents', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD),
    });

    await app.request('/webhooks/tenant-1/datadog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DATADOG_PAYLOAD_2),
    });

    // Two separate incidents created
    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  // ── Scenario 5: Add back the real HTTP check ──────────────────────────
  // The full AC-015 requires demonstrating that the second POST's HTTP
  // response explicitly returns the existing incident ID.
});
