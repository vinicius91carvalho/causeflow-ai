import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IUsageRecordRepository, ListUsageOptions } from '../domain/usage-record.repository.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { UsageRecord } from '../domain/usage-record.entity.js';
export interface UsageSummary {
    account: BillingAccount | null;
    records: UsageRecord[];
    cursor?: string;
}
export declare class GetUsageUseCase {
    private readonly billingAccountRepo;
    private readonly usageRecordRepo;
    constructor(billingAccountRepo: IBillingAccountRepository, usageRecordRepo: IUsageRecordRepository);
    execute(tenantId: TenantId, options?: ListUsageOptions): Promise<UsageSummary>;
}
