/**
 * Postgres Audit entry repository implementation for the OSS runtime (AC-040).
 */
import type { IAuditRepository } from '../domain/audit.repository.js';
import type { AuditEntry } from '../domain/audit.entity.js';
import type { TenantId, AuditEntryId } from '../../../shared/domain/value-objects.js';
import {
  pgGet,
  pgInsert,
  pgDelete,
  pgQuery,
  pgQueryJson,
  pgUpdate,
} from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'audit_entries';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): AuditEntry {
  return {
    entryId: row.entity_id as unknown as AuditEntryId,
    tenantId: row.data['tenantId'] as unknown as TenantId,
    action: row.data['action'] as AuditEntry['action'],
    actorType: row.data['actorType'] as AuditEntry['actorType'],
    actorUserId: row.data['actorUserId'] as string | undefined,
    actorEmail: row.data['actorEmail'] as string,
    resourceType: row.data['resourceType'] as string,
    resourceId: row.data['resourceId'] as string,
    changes: row.data['changes'] as string | undefined,
    evidences: row.data['evidences'] as AuditEntry['evidences'],
    previousHash: row.data['previousHash'] as string,
    entryHash: row.data['entryHash'] as string,
    pseudonymizedAt: row.data['pseudonymizedAt'] as string | undefined,
    createdAt: row.created_at,
  };
}

export class PgAuditRepository implements IAuditRepository {
  async create(entry: AuditEntry): Promise<AuditEntry> {
    const data: Record<string, unknown> = {
      tenantId: entry.tenantId,
      action: entry.action,
      actorType: entry.actorType,
      actorUserId: entry.actorUserId,
      actorEmail: entry.actorEmail,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      changes: entry.changes,
      previousHash: entry.previousHash,
      entryHash: entry.entryHash,
      evidences: entry.evidences,
      pseudonymizedAt: entry.pseudonymizedAt,
    };
    const row = await pgInsert(TABLE, String(entry.tenantId), String(entry.entryId), data);
    return toDomain(row!);
  }

  async findById(tenantId: TenantId, entryId: string): Promise<AuditEntry | null> {
    const row = await pgGet(TABLE, String(tenantId), entryId);
    if (!row) return null;
    return toDomain(row!);
  }

  async findByTenant(
    tenantId: TenantId,
    options?: { limit?: number; cursor?: string; actorType?: 'user' | 'system' },
  ): Promise<{ items: AuditEntry[]; cursor?: string }> {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [String(tenantId)];
    if (options?.actorType) {
      conditions.push(`data->>'actorType' = $${params.length + 1}`);
      params.push(options.actorType);
    }
    const where = conditions.join(' AND ');
    const rows = await pgQuery(TABLE, where, params, {
      orderBy: 'created_at DESC',
      limit: options?.limit ?? 50,
    });
    return { items: rows.map(toDomain) };
  }

  async findByAction(
    tenantId: TenantId,
    action: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: AuditEntry[]; cursor?: string }> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'action' = $2",
      [String(tenantId), action],
      {
        orderBy: 'created_at DESC',
        limit: options?.limit ?? 50,
      },
    );
    return { items: rows.map(toDomain) };
  }

  async getLastEntry(tenantId: TenantId): Promise<AuditEntry | null> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [String(tenantId)], {
      orderBy: 'created_at DESC',
      limit: 1,
    });
    if (rows.length === 0) return null;
    return toDomain(rows[0]);
  }

  async pseudonymizeActor(
    tenantId: TenantId,
    actorUserId: string,
    pseudonym: string,
  ): Promise<number> {
    const rows = await pgQueryJson(TABLE, "tenant_id = $1 AND data->>'actorUserId' = $2", [
      String(tenantId),
      actorUserId,
    ]);
    for (const row of rows) {
      const { pgUpdate: pgUpd } = await import('../../../shared/infra/db/postgres/pg-utils.js');
      await pgUpd(TABLE, String(tenantId), row.entity_id, {
        actorUserId: pseudonym,
        pseudonymizedAt: new Date().toISOString(),
      });
    }
    return rows.length;
  }

  async findExpired(
    tenantId: TenantId,
    before: Date,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: AuditEntry[]; cursor?: string }> {
    const rows = await pgQuery(
      TABLE,
      'tenant_id = $1 AND created_at < $2',
      [String(tenantId), before.toISOString()],
      {
        orderBy: 'created_at ASC',
        limit: options?.limit ?? 50,
      },
    );
    return { items: rows.map(toDomain) };
  }

  async deleteBatch(tenantId: TenantId, entryIds: string[]): Promise<number> {
    let deleted = 0;
    for (const id of entryIds) {
      try {
        await pgDelete(TABLE, String(tenantId), id);
        deleted++;
      } catch {
        // Skip not found
      }
    }
    return deleted;
  }
}
