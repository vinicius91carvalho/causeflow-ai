import type { AuditEntry } from './audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface IAuditRepository {
  create(entry: AuditEntry): Promise<AuditEntry>;
  findByTenant(
    tenantId: TenantId,
    options?: {
      limit?: number;
      cursor?: string;
      actorType?: 'user' | 'system';
    },
  ): Promise<{
    items: AuditEntry[];
    cursor?: string;
  }>;
  findByAction(
    tenantId: TenantId,
    action: string,
    options?: {
      limit?: number;
      cursor?: string;
    },
  ): Promise<{
    items: AuditEntry[];
    cursor?: string;
  }>;
  getLastEntry(tenantId: TenantId): Promise<AuditEntry | null>;
  /**
   * LGPD/GDPR right-to-erasure: replace the actor identity on every row
   * matching `actorUserId` with a stable pseudonym while preserving hash
   * integrity. Returns the number of rows mutated.
   *
   * Implementations MUST only mutate `actorUserId` + `pseudonymizedAt`.
   * Hash-input fields (`actorEmail`, etc.) must remain untouched — see
   * docs/compliance/audit-retention-policy.md.
   */
  pseudonymizeActor(tenantId: TenantId, actorUserId: string, pseudonym: string): Promise<number>;
  /**
   * Retention enforcement: return entries created strictly before `before`
   * for a tenant. Used by the purge-expired-entries scheduled use case.
   */
  findExpired(
    tenantId: TenantId,
    before: Date,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: AuditEntry[]; cursor?: string }>;
  /**
   * Retention enforcement: hard-delete a batch of entries by id. Hash-chain
   * verification MUST treat purged ranges as documented gaps (see policy).
   */
  deleteBatch(tenantId: TenantId, entryIds: string[]): Promise<number>;
}
