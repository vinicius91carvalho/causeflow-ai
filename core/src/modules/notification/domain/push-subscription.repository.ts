import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { PushSubscription, PushSubscriptionKeys } from './push-subscription.entity.js';

export interface IPushSubscriptionRepository {
  /**
   * Save or update a push subscription for a tenant.
   * If the same endpoint already exists for this tenant, it is replaced.
   */
  upsert(tenantId: TenantId, endpoint: string, keys: PushSubscriptionKeys): Promise<void>;

  /**
   * Return all push subscriptions for a tenant.
   */
  listByTenant(tenantId: TenantId): Promise<PushSubscription[]>;

  /**
   * Remove a push subscription by endpoint.
   */
  delete(tenantId: TenantId, endpoint: string): Promise<void>;

  /**
   * Remove all push subscriptions for a tenant.
   */
  deleteAllByTenant(tenantId: TenantId): Promise<void>;
}
