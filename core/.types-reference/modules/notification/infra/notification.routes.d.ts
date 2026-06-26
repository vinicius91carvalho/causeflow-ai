import { Hono } from 'hono';
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
export declare function createNotificationRoutes(useCases: NotificationUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
