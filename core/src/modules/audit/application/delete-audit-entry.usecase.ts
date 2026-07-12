import type { IAuditRepository } from '../domain/audit.repository.js';
import type { CreateAuditEntryUseCase } from './create-audit-entry.usecase.js';
import type { AuditEntry } from '../domain/audit.entity.js';
import type { TenantId, AuditEntryId } from '../../../shared/domain/value-objects.js';

export interface DeleteAuditEntryInput {
  tenantId: TenantId;
  entryId: AuditEntryId;
  actorUserId?: string;
  actorEmail: string;
}

export interface DeleteAuditEntryResult {
  deleted: number;
  newEntry: AuditEntry;
}

/**
 * Deletes a single audit entry and advances the hash chain by appending a
 * new `audit.entry.deleted` entry. The new entry's `previousHash` is the chain
 * tip that existed at the moment of the DELETE request (captured before any
 * mutation), so the chain advances correctly regardless of which entry was
 * deleted (including the prior tip itself).
 *
 * Ordering: append the deletion record FIRST (CreateAuditEntryUseCase reads
 * the current tip as previousHash == prior tip), then hard-delete the target
 * entry. This keeps the new entry's previousHash equal to the prior tip even
 * when the target entry was the tip.
 */
export class DeleteAuditEntryUseCase {
  constructor(
    private readonly repo: IAuditRepository,
    private readonly createAuditEntry: CreateAuditEntryUseCase,
  ) {}

  async execute(input: DeleteAuditEntryInput): Promise<DeleteAuditEntryResult> {
    // Capture prior tip before any mutation (for the changes record).
    const priorTip = await this.repo.getLastEntry(input.tenantId);
    const priorHash = priorTip?.entryHash ?? '0'.repeat(64);

    // Append the deletion record. CreateAuditEntryUseCase reads the current
    // (unmutated) tip as previousHash, which equals priorHash.
    const newEntry = await this.createAuditEntry.execute({
      tenantId: input.tenantId,
      action: 'audit.entry.deleted',
      actorType: 'user',
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      actorEmail: input.actorEmail,
      resourceType: 'audit',
      resourceId: input.entryId,
      changes: { deletedEntryId: input.entryId, priorTip: priorHash },
    });

    // Hard-delete the target entry (retention purge). Documented as a
    // chain gap by the audit retention policy.
    const deleted = await this.repo.deleteBatch(input.tenantId, [input.entryId]);

    return { deleted, newEntry };
  }
}
