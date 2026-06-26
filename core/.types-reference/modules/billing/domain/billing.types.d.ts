import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan, UsageType, OveragePolicy } from '../../../shared/domain/types.js';
export interface CheckoutInput {
    tenantId: TenantId;
    planId: string;
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
    creditsTotal: number;
    creditsUsed: number;
    creditsRemaining: number;
    investigationsLimit: number;
    investigationsUsed: number;
    eventsLimit: number;
    eventsUsed: number;
    renewDate?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId?: string;
}
/** @deprecated Use PLAN_QUOTAS instead */
export declare const PLAN_CREDITS: Record<string, number>;
export interface PlanQuota {
    investigations: number;
    events: number;
    priceUsd: number;
}
export declare const PLAN_QUOTAS: Record<TenantPlan, PlanQuota>;
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
export declare const QUOTA_PACKS: QuotaPackOption[];
export type { UsageType, OveragePolicy };
