import { NotificationEntity } from '../../../shared/infra/db/entities/NotificationEntity.js';
import { notificationId } from '../../../shared/domain/value-objects.js';
import type { INotificationRepository } from '../domain/notification.repository.js';
import type { Notification } from '../domain/notification.entity.js';
import type { NotificationId, TenantId } from '../../../shared/domain/value-objects.js';
export class DynamoNotificationRepository {
    async create(notification: Notification): Promise<Notification> {
        const result = await NotificationEntity.create({
            tenantId: notification.tenantId,
            notificationId: notification.notificationId,
            channelId: notification.channelId,
            threadId: notification.threadId,
            type: notification.type,
            title: notification.title,
            text: notification.text,
            blocks: notification.blocks,
            status: notification.status,
        }).go();
        return this.toDomain(result.data);
    }
    async findById(tenantId: TenantId, nid: NotificationId): Promise<Notification | null> {
        const result = await NotificationEntity.get({ tenantId, notificationId: nid }).go();
        if (!result.data)
            return null;
        return this.toDomain(result.data);
    }
    async listByTenant(tenantId: TenantId, options?: { cursor?: string; limit?: number }) {
        const query = NotificationEntity.query.primary({ tenantId });
        const result = await query.go({
            limit: options?.limit ?? 20,
            ...(options?.cursor && { cursor: options.cursor }),
            order: 'desc',
        });
        return {
            items: result.data.map((d) => this.toDomain(d)),
            cursor: result.cursor ?? undefined,
        };
    }
    async update(tenantId: TenantId, nid: NotificationId, updates: Partial<Notification>): Promise<Notification> {
        const result = await NotificationEntity.patch({ tenantId, notificationId: nid })
            .set({
            ...(updates.status && { status: updates.status }),
            ...(updates.text !== undefined && { text: updates.text }),
            ...(updates.title !== undefined && { title: updates.title }),
        })
            .go({ response: 'all_new' });
        return this.toDomain(result.data);
    }
    toDomain(data: Record<string, any>) {
        return {
            notificationId: notificationId(data.notificationId),
            tenantId: data.tenantId,
            channelId: data.channelId,
            threadId: data.threadId,
            type: data.type,
            title: data.title ?? '',
            text: data.text,
            blocks: data.blocks,
            status: data.status,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        };
    }
}
