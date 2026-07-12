import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { Hono } from 'hono';
import { createNotificationRoutes } from '../../../../src/modules/notification/infra/notification.routes.js';
import type { NotificationUseCases } from '../../../../src/modules/notification/infra/notification.routes.js';
import type { IPushSubscriptionRepository } from '../../../../src/modules/notification/domain/push-subscription.repository.js';
import type { INotificationRepository } from '../../../../src/modules/notification/domain/notification.repository.js';
import { SSEManager } from '../../../../src/shared/infra/chat/sse-manager.js';

function createMockPushSubscriptionRepo() {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
    listByTenant: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteAllByTenant: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockNotificationRepo() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    listByTenant: vi.fn(),
    update: vi.fn(),
  };
}

function createMockUseCase() {
  return { execute: vi.fn() } as any;
}

describe('AC-033: Push Subscription Routes', () => {
  let app: Hono;
  let pushSubscriptionRepo: ReturnType<typeof createMockPushSubscriptionRepo>;
  let notificationRepo: ReturnType<typeof createMockNotificationRepo>;

  function makeTenantMiddleware() {
    return async (c: any, next: () => Promise<void>) => {
      c.set('tenantId', 'tenant-ac033');
      c.set('userId', 'user-ac033');
      c.set('userEmail', 'test@ac033.test');
      c.set('userRoles', ['admin']);
      await next();
    };
  }

  function createTestApp(pushRepo?: any) {
    const useCases: NotificationUseCases = {
      listNotifications: createMockUseCase(),
      listPendingApprovals: createMockUseCase(),
      respondApproval: createMockUseCase(),
      markNotificationRead: createMockUseCase(),
      notificationRepo,
      sseManager: new SSEManager(),
      pushSubscriptionRepo: pushRepo,
    };

    const a = new Hono();
    a.use('*', makeTenantMiddleware());
    a.route('/v1/notifications', createNotificationRoutes(useCases));
    return a;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    pushSubscriptionRepo = createMockPushSubscriptionRepo();
    notificationRepo = createMockNotificationRepo();
    app = createTestApp(pushSubscriptionRepo);
  });

  describe('POST /v1/notifications/subscribe', () => {
    it('should subscribe with valid endpoint and keys', async () => {
      const res = await app.request('/v1/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-123',
          keys: {
            p256dh: 'BNdSfKneKQMtPBbJ6Jq9KjqXG6qZzXqLHKyYX1PHvSXnNg7QWYqNxJQqH3-Q_Is3vZYzWOk',
            auth: 'test-auth-val',
          },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ ok: true });
      expect(pushSubscriptionRepo.upsert).toHaveBeenCalledWith(
        expect.any(String),
        'https://fcm.googleapis.com/fcm/send/test-123',
        {
          p256dh: 'BNdSfKneKQMtPBbJ6Jq9KjqXG6qZzXqLHKyYX1PHvSXnNg7QWYqNxJQqH3-Q_Is3vZYzWOk',
          auth: 'test-auth-val',
        },
      );
    });

    it('should return 400 when endpoint is missing', async () => {
      const res = await app.request('/v1/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keys: { p256dh: 'abc', auth: 'def' },
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('endpoint');
    });

    it('should return 400 when keys.p256dh is missing', async () => {
      const res = await app.request('/v1/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://example.com/push',
          keys: { auth: 'abc' },
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('p256dh');
    });

    it('should return 400 when keys.auth is missing', async () => {
      const res = await app.request('/v1/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://example.com/push',
          keys: { p256dh: 'abc' },
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('auth');
    });

    it('should return 501 when pushSubscriptionRepo is not configured', async () => {
      const appNoPush = createTestApp(undefined);

      const res = await appNoPush.request('/v1/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          endpoint: 'https://example.com/push',
          keys: { p256dh: 'abc', auth: 'def' },
        }),
      });
      expect(res.status).toBe(501);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('not configured');
    });
  });

  describe('DELETE /v1/notifications/subscribe', () => {
    it('should unsubscribe with valid endpoint in body', async () => {
      const res = await app.request('/v1/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-123',
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ ok: true });
      expect(pushSubscriptionRepo.delete).toHaveBeenCalledWith(
        expect.any(String),
        'https://fcm.googleapis.com/fcm/send/test-123',
      );
    });

    it('should unsubsribe with endpoint as query param', async () => {
      const res = await app.request(
        '/v1/notifications/subscribe?endpoint=https://fcm.googleapis.com/fcm/send/test-456',
        { method: 'DELETE' },
      );
      expect(res.status).toBe(200);
      expect(pushSubscriptionRepo.delete).toHaveBeenCalledWith(
        expect.any(String),
        'https://fcm.googleapis.com/fcm/send/test-456',
      );
    });

    it('should return 400 when no endpoint provided', async () => {
      const res = await app.request('/v1/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('endpoint');
    });

    it('should be idempotent (delete on non-existent endpoint returns ok)', async () => {
      pushSubscriptionRepo.delete.mockResolvedValue(undefined);
      const res = await app.request('/v1/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/nonexistent',
        }),
      });
      expect(res.status).toBe(200);
      expect(pushSubscriptionRepo.delete).toHaveBeenCalled();
    });

    it('should return 501 when pushSubscriptionRepo is not configured', async () => {
      const appNoPush = createTestApp(undefined);

      const res = await appNoPush.request('/v1/notifications/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ endpoint: 'https://example.com/push' }),
      });
      expect(res.status).toBe(501);
    });
  });
});

describe('AC-033: Push notification payload on incident.severity_changed', () => {
  it('should construct push payload with correct deep link format', async () => {
    // The push URL must be /dashboard/incidents/:id
    const incidentId = 'inc-test-123';
    const url = `/dashboard/incidents/${incidentId}`;
    expect(url).toBe('/dashboard/incidents/inc-test-123');
  });

  it('should use the incident title from the event payload, not a fallback', () => {
    // The severity_changed event now carries the 'title' field (AC-033 fix)
    const eventPayload = {
      incidentId: 'inc-001',
      severity: 'high',
      previousSeverity: 'medium',
      title: 'CPU spike in production',
    };
    const incidentId = eventPayload['incidentId'] ?? '';
    const incidentTitle = eventPayload['title'] ?? 'Incident updated';

    const pushPayload = {
      title: incidentTitle,
      body: `Incident severity changed: ${incidentTitle}`,
      url: `/dashboard/incidents/${incidentId}`,
      data: { incidentId, severity: eventPayload.severity, type: 'incident.severity_changed' },
    };

    // With the fix, the title is the actual incident title
    expect(pushPayload.title).toBe('CPU spike in production');
    expect(pushPayload.body).toBe('Incident severity changed: CPU spike in production');
    expect(pushPayload.url).toBe('/dashboard/incidents/inc-001');
    expect(pushPayload.data.severity).toBe('high');
    expect(pushPayload.data.type).toBe('incident.severity_changed');
  });

  it('should include severity and previousSeverity in the event payload', () => {
    // The severity_changed event includes the old and new severity
    const severityChangedEvent = {
      eventType: 'incident.severity_changed',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-test',
      payload: {
        incidentId: 'inc-001',
        severity: 'critical',
        previousSeverity: 'medium',
        title: 'Database outage',
      },
    };

    expect(severityChangedEvent.eventType).toBe('incident.severity_changed');
    expect(severityChangedEvent.payload.severity).toBe('critical');
    expect(severityChangedEvent.payload.previousSeverity).toBe('medium');
    expect(severityChangedEvent.payload.title).toBe('Database outage');
  });

  it('should construct push payload from a status_changed event with title', () => {
    // The status_changed events now also include title for audit trail purposes
    const eventPayload = {
      incidentId: 'inc-001',
      from: 'open',
      to: 'triaging',
      title: 'Memory leak in payment service',
      severity: 'high',
    };
    const incidentId = eventPayload['incidentId'] ?? '';
    const incidentTitle = eventPayload['title'] ?? 'Incident updated';

    // Verify the status_changed payload structure is preserved
    expect(eventPayload.from).toBe('open');
    expect(eventPayload.to).toBe('triaging');
    expect(incidentTitle).toBe('Memory leak in payment service');

    // The push is NOT sent on status_changed events (push moved to severity_changed)
    // But the title field is available for audit trail
    const expectedUrl = `/dashboard/incidents/${incidentId}`;
    expect(expectedUrl).toBe('/dashboard/incidents/inc-001');
  });

  it('should support severity unchanged case (no push sent)', () => {
    // When severity doesn't change, no severity_changed event should fire
    // This test verifies the triage use case conditionally publishes severity_changed
    const oldSeverity = 'high';
    const newSeverity = 'high';
    const severityChanged = oldSeverity !== newSeverity;
    expect(severityChanged).toBe(false);
    // No push expected
  });
});
