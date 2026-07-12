import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { SSEManager } from '../../../shared/infra/chat/sse-manager.js';
import type { IApiKeyRepository } from '../../tenant/domain/api-key.repository.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { WidgetChatUseCase } from '../application/widget-chat.usecase.js';
import type { IWidgetSessionRepository } from '../domain/widget-session.repository.js';
import type { WebPushAdapter } from './web-push.adapter.js';
import { widgetAuthMiddleware } from '../../../shared/infra/http/middleware/widget-auth.middleware.js';
import { widgetCorsMiddleware } from '../../../shared/infra/http/middleware/widget-cors.middleware.js';
import type { WidgetSessionId } from '../../../shared/domain/value-objects.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import { sanitizeIncidentForTenant } from '../../ingestion/domain/incident.entity.js';

export interface WidgetRouteDeps {
  widgetChat: WidgetChatUseCase;
  sessionRepo: IWidgetSessionRepository;
  sseManager: SSEManager;
  apiKeyRepo: IApiKeyRepository;
  tenantRepo: ITenantRepository;
  pushAdapter?: WebPushAdapter;
  incidentRepo: IIncidentRepository;
}

export function createWidgetRoutes(deps: WidgetRouteDeps) {
  const app = new Hono<AppEnv>();

  // Apply widget-specific middleware
  app.use('*', widgetCorsMiddleware(deps.apiKeyRepo, deps.tenantRepo));
  app.use('*', widgetAuthMiddleware(deps.apiKeyRepo));

  // POST /v1/widget/sessions — create new chat session
  app.post('/sessions', async (c) => {
    const tenantId = c.get('tenantId');
    const body = await c.req.json().catch(() => ({}));
    const agentId = c.get('widgetAgentId') ?? body.agentId;
    const agentName = c.get('widgetAgentName') ?? body.agentName;

    const session = await deps.widgetChat.createSession(tenantId, agentId, agentName);

    return c.json(
      {
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
      201,
    );
  });

  // POST /v1/widget/sessions/:sessionId/messages — send message
  app.post('/sessions/:sessionId/messages', async (c) => {
    const tenantId = c.get('tenantId');
    const sessionId = c.req.param('sessionId') as WidgetSessionId;
    const body = await c.req.json();
    const message = body.message;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return c.json({ error: 'Message is required' }, 400);
    }
    if (message.length > 2000) {
      return c.json({ error: 'Message too long (max 2000 chars)' }, 400);
    }

    const result = await deps.widgetChat.execute({
      tenantId,
      sessionId,
      message: message.trim(),
      agentId: c.get('widgetAgentId'),
      agentName: c.get('widgetAgentName'),
    });

    return c.json(result);
  });

  // GET /v1/widget/sessions/:sessionId/stream — SSE for async responses
  app.get('/sessions/:sessionId/stream', (c) => {
    const tenantId = c.get('tenantId');
    const sessionId = c.req.param('sessionId');
    const clientId = `widget:${sessionId}:${randomUUID().slice(0, 8)}`;

    return streamSSE(c, async (stream) => {
      deps.sseManager.addClient(tenantId, clientId, stream);

      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ clientId, sessionId }),
      });

      stream.onAbort(() => {
        deps.sseManager.removeClient(tenantId, clientId);
      });

      // Keep alive until client disconnects
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        try {
          await stream.writeSSE({ event: 'heartbeat', data: '' });
        } catch {
          break;
        }
      }
    });
  });

  // POST /v1/widget/sessions/:sessionId/push-subscribe — register Web Push
  app.post('/sessions/:sessionId/push-subscribe', async (c) => {
    const tenantId = c.get('tenantId');
    const sessionId = c.req.param('sessionId') as WidgetSessionId;
    const body = await c.req.json();

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return c.json({ error: 'Invalid push subscription' }, 400);
    }

    await deps.sessionRepo.updatePushSubscription(tenantId, sessionId, {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    });

    return c.json({ ok: true });
  });

  // GET /v1/widget/incidents — latest incidents for this tenant (read-only panel)
  app.get('/incidents', async (c) => {
    const tenantId = c.get('tenantId');
    const result = await deps.incidentRepo.listByCreatedAt(tenantId, {
      limit: 10,
      order: 'desc',
    });
    const items = result.items.map((inc) => {
      const safe = sanitizeIncidentForTenant(inc);
      return {
        incidentId: safe.incidentId,
        title: safe.title,
        severity: safe.severity,
        status: safe.status,
        summary: (safe as any).customerExplanation?.summary ?? safe.description?.slice(0, 120),
        createdAt: safe.createdAt,
        updatedAt: safe.updatedAt,
      };
    });
    return c.json({ items, cursor: result.cursor });
  });

  // GET /v1/widget/config — widget branding config for this tenant
  app.get('/config', async (c) => {
    const tenantId = c.get('tenantId');
    const tenant = await deps.tenantRepo.findById(tenantId);

    const widgetConfig = tenant?.settings?.widgetConfig;
    const vapidPublicKey = deps.pushAdapter?.getVapidPublicKey() ?? '';

    return c.json({
      branding: widgetConfig?.branding ?? {},
      vapidPublicKey,
      maxSessionMessages: widgetConfig?.maxSessionMessages ?? 50,
    });
  });

  // POST /v1/widget/sessions/:sessionId/close — close session
  app.post('/sessions/:sessionId/close', async (c) => {
    const tenantId = c.get('tenantId');
    const sessionId = c.req.param('sessionId') as WidgetSessionId;

    await deps.sessionRepo.close(tenantId, sessionId);
    return c.json({ ok: true });
  });

  return app;
}
