import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IUsageRecordRepository } from '../domain/usage-record.repository.js';
import type { UsageRecord } from '../domain/usage-record.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
export interface RecordUsageInput {
    tenantId: TenantId;
    type: UsageType;
    incidentId?: IncidentId;
    costUsd?: number;
}
export declare class RecordUsageUseCase {
    private readonly billingAccountRepo;
    private readonly usageRecordRepo;
    private readonly eventBus?;
    constructor(billingAccountRepo: IBillingAccountRepository, usageRecordRepo: IUsageRecordRepository, eventBus?: IEventBus | undefined);
    execute(input: RecordUsageInput): Promise<UsageRecord>;
}
