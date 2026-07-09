/**
 * Stub notification repository for the OSS runtime.
 *
 * In-memory storage so the notification/approval module works without DynamoDB.
 * The OSS dashboard does not currently display push notifications, so this
 * minimal implementation preserves the contract without requiring a full
 * Postgres-backed repository.
 */
import type { INotificationRepository } from '../domain/notification.repository.js';
import type { Notification } from '../domain/notification.entity.js';
import type { TenantId, NotificationId } from '../../../shared/domain/value-objects.js';
import { notificationId } from '../../../shared/domain/value-objects.js';
import { v4 as uuid } from 'uuid';

const store = new Map<string, Notification>();

function key(tenantId: string, id: string): string {
  return `${tenantId}::${id}`;
}

export class PgNotificationRepository implements INotificationRepository {
  async create(notification: Notification): Promise<Notification> {
    const id = notification.notificationId ?? notificationId(uuid());
    const stored: Notification = {
      ...notification,
      notificationId: id,
      createdAt: notification.createdAt ?? new Date().toISOString(),
    };
    store.set(key(notification.tenantId, id), stored);
    return stored;
  }

  async findById(tenantId: TenantId, id: NotificationId): Promise<Notification | null> {
    return store.get(key(tenantId, id)) ?? null;
  }

  async listByTenant(tenantId: TenantId, options?: { cursor?: string; limit?: number }): Promise<{ items: Notification[]; cursor?: string }> {
    const result: Notification[] = [];
    for (const [k, v] of store) {
      if (k.startsWith(tenantId + '::')) {
        result.push(v);
      }
    }
    const sorted = result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    const limit = options?.limit ?? 50;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const items = sorted.slice(offset, offset + limit);
    return {
      items,
      cursor: offset + items.length < sorted.length ? String(offset + items.length) : undefined,
    };
  }

  async update(tenantId: TenantId, notificationId: NotificationId, data: Partial<Notification>): Promise<Notification> {
    const existing = store.get(key(tenantId, notificationId));
    if (!existing) throw new Error(`Notification not found: ${notificationId}`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    store.set(key(tenantId, notificationId), updated);
    return updated;
  }
}
