/**
 * Postgres RunbookRegistry repository implementation for the OSS runtime (AC-040).
 * Replaces DynamoRunbookRegistryRepository in the OSS path.
 */
import { pgGet, pgInsert, pgQuery, pgUpdate } from './postgres/pg-utils.js';
import type { TenantId } from '../../domain/value-objects.js';
import type { RunbookEntry } from '../../domain/runbook-registry.entity.js';
import type { IRunbookRegistryRepository } from '../../domain/runbook-registry.repository.js';

const TABLE = 'runbook_registry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): RunbookEntry {
  return {
    tenantId: row.tenant_id as TenantId,
    rootCauseHash: row.entity_id,
    rootCauseSummary: row.data['rootCauseSummary'] as string,
    occurrences: (row.data['occurrences'] ?? 1) as number,
    confirmations: (row.data['confirmations'] ?? 0) as number,
    lastSeen: row.data['lastSeen'] as string,
    fixAction: row.data['fixAction'] as string,
    fixDescription: row.data['fixDescription'] as string,
    automated: (row.data['automated'] ?? false) as boolean,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgRunbookRegistryRepository implements IRunbookRegistryRepository {
  async upsert(entry: RunbookEntry): Promise<RunbookEntry> {
    const data: Record<string, unknown> = {
      rootCauseSummary: entry.rootCauseSummary,
      occurrences: entry.occurrences,
      confirmations: entry.confirmations,
      lastSeen: entry.lastSeen,
      fixAction: entry.fixAction,
      fixDescription: entry.fixDescription,
      automated: entry.automated,
    };
    const existing = await pgGet(TABLE, entry.tenantId, entry.rootCauseHash);
    if (existing) {
      const row = await pgUpdate(TABLE, entry.tenantId, entry.rootCauseHash, data);
      return toDomain(row);
    }
    // For insert, include createdAt
    data['createdAt'] = entry.createdAt;
    const row = await pgInsert(TABLE, entry.tenantId, entry.rootCauseHash, data);
    return toDomain(row);
  }

  async findByHash(tenantId: TenantId, rootCauseHash: string): Promise<RunbookEntry | null> {
    const row = await pgGet(TABLE, tenantId, rootCauseHash);
    if (!row) return null;
    return toDomain(row);
  }

  async findEligible(tenantId: TenantId, minOccurrences: number = 5): Promise<RunbookEntry[]> {
    // Query runbooks where occurrences >= minOccurrences and confirmations >= 1
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND (data->>'occurrences')::int >= $2 AND (data->>'confirmations')::int >= 1",
      [tenantId, minOccurrences],
      { orderBy: 'created_at DESC' },
    );
    return rows.map(toDomain);
  }

  async listByTenant(tenantId: TenantId): Promise<RunbookEntry[]> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [tenantId], { orderBy: 'created_at DESC' });
    return rows.map(toDomain);
  }
}
