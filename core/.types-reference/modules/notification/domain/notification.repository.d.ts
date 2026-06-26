import type { TenantId, NotificationId } from '../../../shared/domain/value-objects.js';
import type { Notification } from './notification.entity.js';
export interface INotificationRepository {
    create(notification: Notification): Promise<Notification>;
    findById(tenantId: TenantId, notificationId: NotificationId): Promise<Notification | null>;
    listByTenant(tenantId: TenantId, options?: {
        cursor?: string;
        limit?: number;
    }): Promise<{
        items: Notification[];
        cursor?: string;
    }>;
    update(tenantId: TenantId, notificationId: NotificationId, updates: Partial<Notification>): Promise<Notification>;
}
