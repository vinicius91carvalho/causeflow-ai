import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
import type { BillingAccount } from './billing-account.entity.js';
export interface IBillingAccountRepository {
    create(account: BillingAccount): Promise<BillingAccount>;
    findByTenantId(tenantId: TenantId): Promise<BillingAccount | null>;
    update(tenantId: TenantId, data: Partial<Omit<BillingAccount, 'tenantId' | 'createdAt'>>): Promise<BillingAccount>;
    /**
     * Atomically increment usage counter for investigations or events.
     * @returns true if incremented, false if limit reached (and overagePolicy is 'block')
     */
    incrementUsageAtomic(tenantId: TenantId, type: UsageType): Promise<boolean>;

    /**
     * Atomically reserve an investigation credit (increment investigationsUsed if under limit).
     * @returns { reserved: true } or { reserved: false, reason: 'quota_exceeded' }
     */
    reserveInvestigation(tenantId: TenantId): Promise<{ reserved: boolean; reason?: string }>;

    /**
     * Confirm a reserved investigation. No-op since the counter was already incremented during reserve.
     */
    confirmInvestigation(tenantId: TenantId): Promise<void>;

    /**
     * Refund a reserved investigation by decrementing investigationsUsed by 1.
     */
    refundInvestigation(tenantId: TenantId): Promise<void>;
}
