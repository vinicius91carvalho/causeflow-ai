import type { TenantId, NotificationId } from '../../../shared/domain/value-objects.js';
import type { NotificationType, NotificationStatus } from '../../../shared/domain/types.js';
export interface Notification {
    notificationId: NotificationId;
    tenantId: TenantId;
    channelId: string;
    threadId?: string;
    type: NotificationType;
    title: string;
    text: string;
    blocks?: Record<string, unknown>[];
    status: NotificationStatus;
    createdAt: string;
    updatedAt: string;
}
