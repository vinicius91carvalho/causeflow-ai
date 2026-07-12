import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { PushSubscription, PushSubscriptionKeys } from '../domain/push-subscription.entity.js';
import type { IPushSubscriptionRepository } from '../domain/push-subscription.repository.js';
import { getPgPool } from '../../../shared/infra/db/pg-client.js';
import { logger } from '../../../shared/infra/logger.js';

export class PgPushSubscriptionRepository implements IPushSubscriptionRepository {
  async upsert(tenantId: TenantId, endpoint: string, keys: PushSubscriptionKeys): Promise<void> {
    try {
      const pool = await getPgPool();
      const entityId = endpoint;
      const data = JSON.stringify({ keys, endpoint, createdAt: new Date().toISOString() });
      await pool.query(
        `INSERT INTO causeflow.push_subscriptions (tenant_id, entity_id, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW(), NOW())
         ON CONFLICT (tenant_id, entity_id)
         DO UPDATE SET data = $3::jsonb, updated_at = NOW()`,
        [tenantId, entityId, data],
      );
    } catch (err) {
      logger.error({ err, tenantId, endpoint }, 'Failed to upsert push subscription');
      throw err;
    }
  }

  async listByTenant(tenantId: TenantId): Promise<PushSubscription[]> {
    try {
      const pool = await getPgPool();
      const result = await pool.query(
        'SELECT data FROM causeflow.push_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC',
        [tenantId],
      );
      return (result.rows as { data: Record<string, unknown> }[]).map((r) => {
        const d = r.data as any;
        return {
          tenantId,
          endpoint: d.endpoint,
          keys: d.keys as PushSubscriptionKeys,
          createdAt: d.createdAt ?? '',
        };
      });
    } catch (err) {
      logger.error({ err, tenantId }, 'Failed to list push subscriptions');
      return [];
    }
  }

  async delete(tenantId: TenantId, endpoint: string): Promise<void> {
    try {
      const pool = await getPgPool();
      await pool.query(
        'DELETE FROM causeflow.push_subscriptions WHERE tenant_id = $1 AND entity_id = $2',
        [tenantId, endpoint],
      );
    } catch (err) {
      logger.error({ err, tenantId, endpoint }, 'Failed to delete push subscription');
      throw err;
    }
  }

  async deleteAllByTenant(tenantId: TenantId): Promise<void> {
    try {
      const pool = await getPgPool();
      await pool.query('DELETE FROM causeflow.push_subscriptions WHERE tenant_id = $1', [tenantId]);
    } catch (err) {
      logger.error({ err, tenantId }, 'Failed to delete all push subscriptions');
      throw err;
    }
  }
}
