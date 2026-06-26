import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock the widget-auth middleware to inject tenantId directly
vi.mock('../../../../src/shared/infra/http/middleware/widget-auth.middleware.js', () => ({
  widgetAuthMiddleware: () => async (c: unknown, next: () => Promise<void>) => {
    const { tenantId } = await import('../../../../src/shared/domain/value-objects.js');
    const cs = c as { set: (key: string, value: unknown) => void };
    cs.set('tenantId', tenantId('tenant-1'));
    cs.set('widgetAuth', true);
    cs.set('userId', '');
    cs.set('userEmail', '');
    cs.set('userRoles', ['widget']);
    return next();
  },
}));

// Mock widget-cors middleware to be a no-op
vi.mock('../../../../src/shared/infra/http/middleware/widget-cors.middleware.js', () => ({
  widgetCorsMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import { Hono } from 'hono';
import { createWidgetRoutes } from '../../../../src/modules/widget/infra/widget.routes.js';
import type { WidgetRouteDeps } from '../../../../src/modules/widget/infra/widget.routes.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';
import { errorHandler } from '../../../../src/shared/infra/http/middleware/error-handler.js';
import { widgetSessionId } from '../../../../src/shared/domain/value-objects.js';
import { SSEManager } from '../../../../src/shared/infra/chat/sse-manager.js';

function createMockDeps(): WidgetRouteDeps {
  return {
    widgetChat: {
      createSession: vi.fn(async () => ({
        sessionId: widgetSessionId('ws-test'),
        tenantId: 'tenant-1',
        messages: [],
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
      })),
      execute: vi.fn(async () => ({
        sessionId: widgetSessionId('ws-test'),
        chatId: 'chat-1',
        response: { text: 'Hello!' },
        status: 'completed' as const,
      })),
    } as any,
    sessionRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      appendMessage: vi.fn(),
      updatePushSubscription: vi.fn(),
      close: vi.fn(),
    },
    sseManager: new SSEManager(),
    apiKeyRepo: {
      create: vi.fn(),
      findByHash: vi.fn(),
      findById: vi.fn(),
      listByTenant: vi.fn(),
      revoke: vi.fn(),
    },
    tenantRepo: {
      create: vi.fn(),
      findById: vi.fn(async () => ({
        tenantId: 'tenant-1',
        name: 'Acme',
        slug: 'acme',
        ownerEmail: 'a@b.com',
        plan: 'starter',
        status: 'active',
        settings: { maxIncidentsPerMonth: 50, autoRemediation: false, notificationChannels: [] },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      } as unknown as Tenant)),
      findBySlug: vi.fn(),
      findByCustomDomain: vi.fn(),
      update: vi.fn(),
      listByOwner: vi.fn(),
    },
  };
}

describe('widget.routes', () => {
  let deps: WidgetRouteDeps;
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    app = new Hono();
    app.onError(errorHandler);
    app.route('/v1/widget', createWidgetRoutes(deps));
  });

  describe('POST /v1/widget/sessions', () => {
    it('should create a session and return 201', async () => {
      const res = await app.request('/v1/widget/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty('sessionId', 'ws-test');
      expect(deps.widgetChat.createSession).toHaveBeenCalledOnce();
    });
  });

  describe('POST /v1/widget/sessions/:sessionId/messages', () => {
    it('should send a message and return response', async () => {
      const res = await app.request('/v1/widget/sessions/ws-test/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, any>;
      expect(body).toHaveProperty('response');
      expect(body.response.text).toBe('Hello!');
    });

    it('should reject empty message with 400', async () => {
      const res = await app.request('/v1/widget/sessions/ws-test/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject message over 2000 chars with 400', async () => {
      const res = await app.request('/v1/widget/sessions/ws-test/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'x'.repeat(2001) }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/widget/sessions/:sessionId/push-subscribe', () => {
    it('should register push subscription', async () => {
      const res = await app.request('/v1/widget/sessions/ws-test/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub',
          keys: { p256dh: 'key1', auth: 'key2' },
        }),
      });

      expect(res.status).toBe(200);
      expect(deps.sessionRepo.updatePushSubscription).toHaveBeenCalledOnce();
    });

    it('should reject invalid push subscription with 400', async () => {
      const res = await app.request('/v1/widget/sessions/ws-test/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://push.example.com' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/widget/config', () => {
    it('should return branding config', async () => {
      const res = await app.request('/v1/widget/config');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('branding');
      expect(body).toHaveProperty('maxSessionMessages');
    });
  });

  describe('POST /v1/widget/sessions/:sessionId/close', () => {
    it('should close session', async () => {
      const res = await app.request('/v1/widget/sessions/ws-test/close', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      expect(deps.sessionRepo.close).toHaveBeenCalledOnce();
    });
  });
});
