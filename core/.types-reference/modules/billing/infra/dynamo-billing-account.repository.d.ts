import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
export declare class DynamoBillingAccountRepository implements IBillingAccountRepository {
    create(account: BillingAccount): Promise<BillingAccount>;
    findByTenantId(tenantId: TenantId): Promise<BillingAccount | null>;
    update(tenantId: TenantId, data: Partial<Omit<BillingAccount, 'tenantId' | 'createdAt'>>): Promise<BillingAccount>;
    incrementUsageAtomic(tenantId: TenantId, type: UsageType): Promise<boolean>;
}
