/**
 * Postgres Integration repository for the OSS runtime (AC-056).
 */
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IIntegrationRepository } from '../domain/integration.repository.js';
import type { IntegrationRecord } from '../domain/integration.entity.js';
import { pgGet, pgInsert, pgQuery, pgUpdate } from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'integrations';

function toDomain(row: {
  tenant_id: string;
  entity_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}): IntegrationRecord {
  const data = row.data ?? {};
  return {
    tenantId: row.tenant_id as TenantId,
    integrationId: row.entity_id,
    provider: String(data['provider'] ?? ''),
    category: String(data['category'] ?? 'monitoring'),
    status: (data['status'] as IntegrationRecord['status']) ?? 'active',
    displayName: String(data['displayName'] ?? data['provider'] ?? row.entity_id),
    config: (data['config'] as Record<string, unknown>) ?? {},
    connectedBy: data['connectedBy'] as string | undefined,
    lastHealthCheck: data['lastHealthCheck'] as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toData(record: IntegrationRecord): Record<string, unknown> {
  return {
    provider: record.provider,
    category: record.category,
    status: record.status,
    displayName: record.displayName,
    config: record.config,
    connectedBy: record.connectedBy,
    lastHealthCheck: record.lastHealthCheck,
  };
}

export class PgIntegrationRepository implements IIntegrationRepository {
  async upsert(record: IntegrationRecord): Promise<IntegrationRecord> {
    const existing = await pgGet(TABLE, String(record.tenantId), record.integrationId);
    const data = toData(record);
    const row = existing
      ? await pgUpdate(TABLE, String(record.tenantId), record.integrationId, data)
      : await pgInsert(TABLE, String(record.tenantId), record.integrationId, data);
    return toDomain(row);
  }

  async findByProvider(tenantId: TenantId, provider: string): Promise<IntegrationRecord | null> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'provider' = $2",
      [String(tenantId), provider],
      { limit: 1 },
    );
    if (rows.length === 0) return null;
    return toDomain(rows[0]!);
  }

  async listByTenant(tenantId: TenantId): Promise<IntegrationRecord[]> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [String(tenantId)], {
      orderBy: 'created_at DESC',
    });
    return rows.map(toDomain);
  }

  async updateHealthCheck(
    tenantId: TenantId,
    integrationId: string,
    checkedAt: string,
  ): Promise<void> {
    await pgUpdate(TABLE, String(tenantId), integrationId, { lastHealthCheck: checkedAt });
  }
}
