import type { INotificationRepository } from '../domain/notification.repository.js';
import type { Notification } from '../domain/notification.entity.js';
import type { TenantId, NotificationId } from '../../../shared/domain/value-objects.js';
export declare class DynamoNotificationRepository implements INotificationRepository {
    create(notification: Notification): Promise<Notification>;
    findById(tenantId: TenantId, nid: NotificationId): Promise<Notification | null>;
    listByTenant(tenantId: TenantId, options?: {
        cursor?: string;
        limit?: number;
    }): Promise<{
        items: Notification[];
        cursor?: string;
    }>;
    update(tenantId: TenantId, nid: NotificationId, updates: Partial<Notification>): Promise<Notification>;
    private toDomain;
}
