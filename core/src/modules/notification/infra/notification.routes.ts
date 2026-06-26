import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { tenantId, notificationId, approvalId } from '../../../shared/domain/value-objects.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ListNotificationsUseCase } from '../application/list-notifications.usecase.js';
import type { ListPendingApprovalsUseCase } from '../application/list-pending-approvals.usecase.js';
import type { RespondApprovalUseCase } from '../application/respond-approval.usecase.js';
import type { MarkNotificationReadUseCase } from '../application/mark-notification-read.usecase.js';
import type { INotificationRepository } from '../domain/notification.repository.js';
import type { SSEManager } from '../../../shared/infra/chat/sse-manager.js';

export interface NotificationUseCases {
    listNotifications: ListNotificationsUseCase;
    listPendingApprovals: ListPendingApprovalsUseCase;
    respondApproval: RespondApprovalUseCase;
    markNotificationRead: MarkNotificationReadUseCase;
    notificationRepo: INotificationRepository;
    sseManager: SSEManager;
}

export function createNotificationRoutes(useCases: NotificationUseCases) {
    const app = new Hono<AppEnv>();
    // GET /v1/notifications/stream — SSE endpoint (must be before /:id)
    app.get('/stream', (c) => {
        const tid = c.get('tenantId');
        const clientId = randomUUID();
        return streamSSE(c, async (stream) => {
            useCases.sseManager.addClient(tid, clientId, stream);
            await stream.writeSSE({
                event: 'connected',
                data: JSON.stringify({ clientId, tenantId: tid }),
            });
            stream.onAbort(() => {
                useCases.sseManager.removeClient(tid, clientId);
            });
            // Keep alive until client disconnects
            while (true) {
                await new Promise((resolve) => setTimeout(resolve, 30_000));
                try {
                    await stream.writeSSE({ event: 'heartbeat', data: '' });
                }
                catch {
                    break;
                }
            }
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
        const result = await useCases.markNotificationRead.execute({ tenantId: tid, notificationId: nid });
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
    return app;
}
