import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
import type { UsageRecord } from './usage-record.entity.js';
export interface ListUsageOptions {
    limit?: number;
    cursor?: string;
    type?: UsageType;
}
export interface IUsageRecordRepository {
    create(record: UsageRecord): Promise<UsageRecord>;
    listByTenant(tenantId: TenantId, options?: ListUsageOptions): Promise<{
        items: UsageRecord[];
        cursor?: string;
    }>;
}
