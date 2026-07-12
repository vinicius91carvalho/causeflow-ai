import { auditEntryId, tenantId } from '../../../shared/domain/value-objects.js';
import { AuditEntryEntity } from '../../../shared/infra/db/entities/AuditEntryEntity.js';
import type { AuditEntry, AuditEvidence } from '../domain/audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

function parseEvidences(raw: unknown): AuditEvidence[] | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditEvidence[]) : undefined;
  } catch {
    return undefined;
  }
}

function toDomain(raw: Record<string, unknown>): AuditEntry {
  const evidences = parseEvidences(raw['evidences']);
  return {
    tenantId: tenantId(raw['tenantId'] as string),
    entryId: auditEntryId(raw['entryId'] as string),
    action: raw['action'],
    actorType: raw['actorType'],
    actorUserId: raw['actorUserId'],
    actorEmail: raw['actorEmail'],
    resourceType: raw['resourceType'],
    resourceId: raw['resourceId'],
    changes: raw['changes'],
    ...(evidences !== undefined && { evidences }),
    previousHash: raw['previousHash'],
    entryHash: raw['entryHash'],
    createdAt: raw['createdAt'],
    pseudonymizedAt: raw['pseudonymizedAt'],
  } as AuditEntry;
}
export class DynamoAuditRepository {
  async create(entry: AuditEntry): Promise<AuditEntry> {
    const result = await AuditEntryEntity.create({
      tenantId: entry.tenantId,
      entryId: entry.entryId,
      action: entry.action,
      actorType: entry.actorType,
      actorUserId: entry.actorUserId,
      actorEmail: entry.actorEmail,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      changes: entry.changes,
      ...(entry.evidences !== undefined && {
        evidences: JSON.stringify(entry.evidences),
      }),
      previousHash: entry.previousHash,
      entryHash: entry.entryHash,
      pseudonymizedAt: entry.pseudonymizedAt,
    }).go();
    return toDomain(result.data as unknown as Record<string, unknown>);
  }
  async findByTenant(
    tid: TenantId,
    options?: { limit?: number; cursor?: string; actorType?: 'user' | 'system' },
  ) {
    const baseQuery = AuditEntryEntity.query.byCreatedAt({ tenantId: tid });
    const goOpts = {
      limit: options?.limit ?? 20,
      order: 'desc' as const,
      ...(options?.cursor && { cursor: options.cursor }),
    };
    const actorTypeFilter = options?.actorType;
    let result: Awaited<ReturnType<typeof baseQuery.go>>;
    if (actorTypeFilter === 'user' || actorTypeFilter === 'system') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = await baseQuery
        .where(({ actorType }, { eq }) => eq(actorType, actorTypeFilter as any))
        .go(goOpts);
    } else {
      result = await baseQuery.go(goOpts);
    }
    return {
      items: result.data.map((item) => toDomain(item as unknown as Record<string, unknown>)),
      cursor: result.cursor ?? undefined,
    };
  }

  /**
   * Backfill gsi3pk/gsi3sk for pre-existing rows that lack them.
   * Walks the primary index page-by-page and patches each row so ElectroDB
   * recomputes the GSI3 composite keys. Returns the total count patched.
   * NOT on IAuditRepository — concrete-only, called from the backfill script.
   */
  async backfillCreatedAtIndex(tid: TenantId): Promise<number> {
    let cursor: string | undefined;
    let count = 0;
    do {
      const page = await AuditEntryEntity.query
        .primary({ tenantId: tid })
        .go({ limit: 100, ...(cursor && { cursor }) });
      for (const item of page.data) {
        const raw = item as unknown as Record<string, unknown>;
        await AuditEntryEntity.patch({
          tenantId: tid,
          entryId: raw['entryId'] as string,
        })
          .set({})
          .go();
        count++;
      }
      cursor = page.cursor ?? undefined;
    } while (cursor);
    return count;
  }
  async findByAction(tid: TenantId, action: string, options?: { limit?: number; cursor?: string }) {
    const result = await AuditEntryEntity.query.byAction({ tenantId: tid, action }).go({
      limit: options?.limit ?? 20,
      order: 'desc',
      ...(options?.cursor && { cursor: options.cursor }),
    });
    return {
      items: result.data.map((item) => toDomain(item as unknown as Record<string, unknown>)),
      cursor: result.cursor ?? undefined,
    };
  }
  async getLastEntry(tid: TenantId): Promise<AuditEntry | null> {
    // Chronological tip of the hash chain. MUST query the byCreatedAt GSI
    // (sort key = createdAt) — the primary index is sorted by entryId (UUID),
    // so `order: 'desc'` on primary would return the lexicographically-highest
    // UUID, not the most recent entry, breaking the chain. Using the same
    // index as findByTenant keeps the tip consistent with list reads.
    const result = await AuditEntryEntity.query
      .byCreatedAt({ tenantId: tid })
      .go({ limit: 1, order: 'desc' });
    const first = result.data[0];
    if (!first) return null;
    return toDomain(first as unknown as Record<string, unknown>);
  }
  async pseudonymizeActor(tid: TenantId, actorUserId: string, pseudonym: string): Promise<number> {
    // Scan-and-patch implementation. Scoped to a single tenant partition
    // (PK=tenantId) so this is a bounded query, not a table scan. The
    // audit repository port forbids mutating hash-input fields — we only
    // touch actorUserId + pseudonymizedAt, keeping entryHash valid.
    let cursor: string | undefined;
    let mutated = 0;
    const now = new Date().toISOString();
    do {
      const page = await AuditEntryEntity.query
        .primary({ tenantId: tid })
        .go({ limit: 100, ...(cursor && { cursor }) });
      for (const item of page.data) {
        const raw = item as unknown as Record<string, unknown>;
        if (raw['actorUserId'] === actorUserId) {
          await AuditEntryEntity.patch({
            tenantId: tid,
            entryId: raw['entryId'] as string,
          })
            .set({ actorUserId: pseudonym, pseudonymizedAt: now })
            .go();
          mutated++;
        }
      }
      cursor = page.cursor ?? undefined;
    } while (cursor);
    return mutated;
  }
  async findExpired(tid: TenantId, before: Date, options?: { limit?: number; cursor?: string }) {
    const beforeIso = before.toISOString();
    const result = await AuditEntryEntity.query.primary({ tenantId: tid }).go({
      limit: options?.limit ?? 100,
      order: 'asc',
      ...(options?.cursor && { cursor: options.cursor }),
    });
    const items = result.data
      .map((item) => toDomain(item as unknown as Record<string, unknown>))
      .filter((entry) => entry.createdAt < beforeIso);
    return { items, cursor: result.cursor ?? undefined };
  }
  async deleteBatch(tid: TenantId, entryIds: string[]): Promise<number> {
    let deleted = 0;
    for (const entryId of entryIds) {
      await AuditEntryEntity.delete({ tenantId: tid, entryId }).go();
      deleted++;
    }
    return deleted;
  }
}
