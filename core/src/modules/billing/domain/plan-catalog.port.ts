import type { TenantPlan, UsageType } from '../../../shared/domain/types.js';

export interface PlanDefinition {
    planKey: TenantPlan;
    name: string;
    priceUsd: number;
    priceAnnualUsd?: number;
    investigationsLimit: number;
    eventsLimit: number;
    trialDays: number;
    features: string[];
    highlighted?: boolean;
    selfService: boolean;
    overagePerInvestigation?: number;
    stripePriceId: string;
    stripeProductId: string;
    metered?: {
        invPriceId: string;
        evtPriceId: string;
    };
}

export interface QuotaPackDefinition {
    type: UsageType;
    amount: number;
    priceUsd: number;
    stripePriceId: string;
}

export interface IPlanCatalogService {
    /** Get all available plans (for pricing page) */
    listPlans(): Promise<PlanDefinition[]>;

    /** Get a single plan by its plan_key */
    getPlanByKey(planKey: TenantPlan): Promise<PlanDefinition | null>;

    /** Get a plan by its Stripe Price ID (for webhook resolution) */
    getPlanByPriceId(priceId: string): Promise<PlanDefinition | null>;

    /** Get available quota packs */
    listQuotaPacks(): Promise<QuotaPackDefinition[]>;

    /** Force refresh the cache */
    invalidateCache(): Promise<void>;
}
