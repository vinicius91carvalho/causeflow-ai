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
}
