/**
 * Postgres Usage Record repository for the OSS runtime (AC-050).
 * Stores usage records in the causeflow.usage_records table.
 */
import { v4 as uuid } from 'uuid';
import type {
  IUsageRecordRepository,
  ListUsageOptions,
} from '../domain/usage-record.repository.js';
import type { UsageRecord } from '../domain/usage-record.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import { usageRecordId } from '../../../shared/domain/value-objects.js';
import { pgGet, pgInsert, pgUpdate, pgQuery } from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'usage_records';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): UsageRecord {
  return {
    recordId: usageRecordId(row.entity_id),
    tenantId: row.tenant_id,
    type: row.data['type'] as UsageRecord['type'],
    costUsd: row.data['costUsd'] as number | undefined,
    agentBreakdown: row.data['agentBreakdown'] as UsageRecord['agentBreakdown'],
    incidentId: row.data['incidentId'] as UsageRecord['incidentId'],
    createdAt: row.created_at,
  };
}

export class PgUsageRecordRepository implements IUsageRecordRepository {
  async create(record: UsageRecord): Promise<UsageRecord> {
    const data: Record<string, unknown> = {
      type: record.type,
      costUsd: record.costUsd,
      agentBreakdown: record.agentBreakdown,
      incidentId: record.incidentId,
    };
    const row = await pgInsert(TABLE, record.tenantId, record.recordId, data);
    return toDomain(row);
  }

  async listByTenant(
    tenantId: TenantId,
    options?: ListUsageOptions,
  ): Promise<{ items: UsageRecord[]; cursor?: string }> {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];

    if (options?.type) {
      conditions.push(`data->>'type' = $${params.length + 1}`);
      params.push(options.type);
    }

    const rows = await pgQuery(TABLE, conditions.join(' AND '), params, {
      orderBy: 'created_at DESC',
      limit: options?.limit ?? 50,
      offset: options?.cursor ? parseInt(options.cursor, 10) : undefined,
    });
    return {
      items: rows.map(toDomain),
      cursor:
        rows.length === (options?.limit ?? 50)
          ? String((options?.cursor ? parseInt(options.cursor, 10) : 0) + rows.length)
          : undefined,
    };
  }
}
