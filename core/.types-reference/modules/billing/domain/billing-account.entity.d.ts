import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan, OveragePolicy } from '../../../shared/domain/types.js';
export interface BillingAccount {
    tenantId: TenantId;
    plan: TenantPlan;
    periodStart: string;
    periodEnd: string;
    investigationsLimit: number;
    investigationsUsed: number;
    eventsLimit: number;
    eventsUsed: number;
    overagePolicy: OveragePolicy;
    createdAt: string;
    updatedAt: string;
}
