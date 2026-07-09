import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscription {
  tenantId: TenantId;
  endpoint: string;
  keys: PushSubscriptionKeys;
  createdAt: string;
}
