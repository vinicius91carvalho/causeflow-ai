import { Hono } from 'hono';
import { stream, type SSEStreamingApi } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { tenantId, notificationId, approvalId } from '../../../shared/domain/value-objects.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ListNotificationsUseCase } from '../application/list-notifications.usecase.js';
import type { ListPendingApprovalsUseCase } from '../application/list-pending-approvals.usecase.js';
import type { RespondApprovalUseCase } from '../application/respond-approval.usecase.js';
import type { MarkNotificationReadUseCase } from '../application/mark-notification-read.usecase.js';
import type { INotificationRepository } from '../domain/notification.repository.js';
import type { SSEManager } from '../../../shared/infra/chat/sse-manager.js';
import type { IPushSubscriptionRepository } from '../domain/push-subscription.repository.js';

export interface NotificationUseCases {
  listNotifications: ListNotificationsUseCase;
  listPendingApprovals: ListPendingApprovalsUseCase;
  respondApproval: RespondApprovalUseCase;
  markNotificationRead: MarkNotificationReadUseCase;
  notificationRepo: INotificationRepository;
  sseManager: SSEManager;
  pushSubscriptionRepo?: IPushSubscriptionRepository;
}

export function createNotificationRoutes(useCases: NotificationUseCases) {
  const app = new Hono<AppEnv>();
  // GET /v1/notifications/stream — SSE endpoint (must be before /:id)
  app.get('/stream', (c) => {
    const tid = c.get('tenantId');
    const clientId = randomUUID();
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    return stream(c, async (s) => {
      const clientStream = {
        writeSSE: async ({ event, data, id }: { event?: string; data?: string; id?: string }) => {
          await s.write(
            `${id ? `id: ${id}\n` : ''}${event ? `event: ${event}\n` : ''}data: ${data ?? ''}\n\n`,
          );
        },
      };
      useCases.sseManager.addClient(tid, clientId, clientStream as SSEStreamingApi);
      s.onAbort(() => useCases.sseManager.removeClient(tid, clientId));
      await clientStream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ clientId, tenantId: tid }),
      });
      await new Promise(() => {});
    });
  });
  // GET /v1/notifications/ — list notifications
  app.get('/', async (c) => {
    const tid = tenantId(c.get('tenantId'));
    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;
    const result = await useCases.listNotifications.execute({ tenantId: tid, cursor, limit });
    return c.json(result);
  });
  // GET /v1/notifications/:id — get notification detail
  app.get('/:id', async (c) => {
    const tid = tenantId(c.get('tenantId'));
    const nid = notificationId(c.req.param('id'));
    const notification = await useCases.notificationRepo.findById(tid, nid);
    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    return c.json(notification);
  });
  // PATCH /v1/notifications/:id/read — mark as read
  app.patch('/:id/read', async (c) => {
    const tid = tenantId(c.get('tenantId'));
    const nid = notificationId(c.req.param('id'));
    const result = await useCases.markNotificationRead.execute({
      tenantId: tid,
      notificationId: nid,
    });
    return c.json(result);
  });
  // GET /v1/notifications/approvals/pending — list pending approvals
  app.get('/approvals/pending', async (c) => {
    const tid = tenantId(c.get('tenantId'));
    const approvals = await useCases.listPendingApprovals.execute({ tenantId: tid });
    return c.json({ items: approvals });
  });
  // POST /v1/notifications/approvals/:id/respond — respond to approval
  app.post('/approvals/:id/respond', async (c) => {
    const tid = tenantId(c.get('tenantId'));
    const aid = approvalId(c.req.param('id'));
    const body = await c.req.json();
    const result = await useCases.respondApproval.execute({
      tenantId: tid,
      approvalId: aid,
      action: body.action,
      respondedBy: body.respondedBy,
    });
    return c.json(result);
  });

  // POST /v1/notifications/subscribe — subscribe to push notifications (VAPID)
  app.post('/subscribe', async (c) => {
    if (!useCases.pushSubscriptionRepo) {
      return c.json({ error: 'Push notifications not configured' }, 501);
    }
    const tid = tenantId(c.get('tenantId'));
    const body = await c.req.json();
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return c.json({ error: 'endpoint, keys.p256dh, and keys.auth are required' }, 400);
    }
    await useCases.pushSubscriptionRepo.upsert(tid, body.endpoint, {
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });
    return c.json({ ok: true });
  });

  // DELETE /v1/notifications/subscribe — unsubscribe from push notifications
  app.delete('/subscribe', async (c) => {
    if (!useCases.pushSubscriptionRepo) {
      return c.json({ error: 'Push notifications not configured' }, 501);
    }
    const tid = tenantId(c.get('tenantId'));
    const body = await c.req.json().catch(() => ({}));
    const endpoint = c.req.query('endpoint') || body.endpoint;
    if (!endpoint) {
      return c.json({ error: 'endpoint query parameter or body field is required' }, 400);
    }
    await useCases.pushSubscriptionRepo.delete(tid, endpoint);
    return c.json({ ok: true });
  });

  return app;
}
