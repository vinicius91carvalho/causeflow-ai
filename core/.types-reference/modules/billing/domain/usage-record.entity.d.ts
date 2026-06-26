import type { TenantId, UsageRecordId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
export interface UsageRecord {
    tenantId: TenantId;
    recordId: UsageRecordId;
    type: UsageType;
    incidentId?: IncidentId;
    costUsd?: number;
    createdAt: string;
}
