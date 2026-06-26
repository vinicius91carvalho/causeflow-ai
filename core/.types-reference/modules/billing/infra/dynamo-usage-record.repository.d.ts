import type { IUsageRecordRepository, ListUsageOptions } from '../domain/usage-record.repository.js';
import type { UsageRecord } from '../domain/usage-record.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class DynamoUsageRecordRepository implements IUsageRecordRepository {
    create(record: UsageRecord): Promise<UsageRecord>;
    listByTenant(tenantId: TenantId, options?: ListUsageOptions): Promise<{
        items: UsageRecord[];
        cursor?: string;
    }>;
}
