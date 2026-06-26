import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { QuotaCheckResult } from '../domain/billing.types.js';
export declare class CheckQuotaUseCase {
    private readonly billingAccountRepo;
    private readonly tenantRepo;
    constructor(billingAccountRepo: IBillingAccountRepository, tenantRepo: ITenantRepository);
    execute(tenantId: TenantId, type: UsageType): Promise<QuotaCheckResult>;
    executeOrThrow(tenantId: TenantId, type: UsageType): Promise<QuotaCheckResult>;
}
