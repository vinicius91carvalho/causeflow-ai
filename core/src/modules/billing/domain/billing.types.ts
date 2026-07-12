import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan, UsageType, OveragePolicy } from '../../../shared/domain/types.js';

export interface CheckoutInput {
  tenantId: TenantId;
  planKey: TenantPlan;
  successUrl: string;
  cancelUrl: string;
}

export interface PortalInput {
  tenantId: TenantId;
  returnUrl: string;
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  investigationsLimit: number;
  investigationsUsed: number;
  eventsLimit: number;
  eventsUsed: number;
  renewDate?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

export interface PlanQuota {
  investigations: number;
  events: number;
  priceUsd: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  type: UsageType;
  used: number;
  limit: number;
  remaining: number;
}

export interface QuotaPackOption {
  type: UsageType;
  amount: number;
  priceUsd: number;
}

export type { UsageType, OveragePolicy };

/** @deprecated Fallback only — use IPlanCatalogService. Remove after migration validated in production. */
export const PLAN_CREDITS: Record<TenantPlan, number> = {
  free: 0,
  starter: 15,
  pro: 60,
  business: 200,
  enterprise: 2000,
};
/** @deprecated Fallback only — use IPlanCatalogService. Remove after migration validated in production. */
export const PLAN_QUOTAS: Record<TenantPlan, PlanQuota> = {
  free: { investigations: 0, events: 0, priceUsd: 0 },
  starter: { investigations: 15, events: 500, priceUsd: 99 },
  pro: { investigations: 60, events: 3000, priceUsd: 349 },
  business: { investigations: 200, events: 10000, priceUsd: 899 },
  enterprise: { investigations: -1, events: -1, priceUsd: 0 }, // custom/unlimited
};
/** @deprecated Fallback only — use IPlanCatalogService.listQuotaPacks(). Remove after migration validated in production. */
export const QUOTA_PACKS = [
  { type: 'investigation', amount: 10, priceUsd: 79 },
  { type: 'event', amount: 1000, priceUsd: 99 },
];
