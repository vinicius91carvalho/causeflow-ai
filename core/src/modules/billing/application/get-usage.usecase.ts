import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IUsageRecordRepository, ListUsageOptions } from '../domain/usage-record.repository.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { UsageRecord } from '../domain/usage-record.entity.js';

export interface DailyUsage {
    date: string;
    investigations: number;
    events: number;
}

export interface UsageSummary {
    account: BillingAccount | null;
    records: UsageRecord[];
    daily: DailyUsage[];
    cursor?: string;
}

export class GetUsageUseCase {
    constructor(
        private billingAccountRepo: IBillingAccountRepository,
        private usageRecordRepo: IUsageRecordRepository,
    ) {}

    async execute(tenantId: TenantId, options?: ListUsageOptions): Promise<UsageSummary> {
        const [account, recordsResult] = await Promise.all([
            this.billingAccountRepo.findByTenantId(tenantId),
            this.usageRecordRepo.listByTenant(tenantId, options),
        ]);

        // Aggregate records by day for the chart
        const dailyMap = new Map<string, { investigations: number; events: number }>();
        for (const record of recordsResult.items) {
            const date = record.createdAt.slice(0, 10); // YYYY-MM-DD
            const entry = dailyMap.get(date) ?? { investigations: 0, events: 0 };
            if (record.type === 'investigation') {
                entry.investigations++;
            } else {
                entry.events++;
            }
            dailyMap.set(date, entry);
        }

        const daily: DailyUsage[] = Array.from(dailyMap.entries())
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            account,
            records: recordsResult.items,
            daily,
            cursor: recordsResult.cursor,
        };
    }
}
