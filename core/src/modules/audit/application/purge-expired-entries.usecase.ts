import type { IAuditRepository } from '../domain/audit.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface PurgeExpiredEntriesInput {
    tenantId: TenantId;
    /**
     * Cutoff timestamp — entries with `createdAt < before` are eligible for
     * hard deletion. Callers compute this per-category using the retention
     * table in docs/compliance/audit-retention-policy.md.
     */
    before: Date;
    /**
     * Safety cap per invocation. Defaults to 500. Scheduled purge jobs
     * should loop until `deleted < batchSize` to drain a category.
     */
    batchSize?: number;
}

export interface PurgeExpiredEntriesResult {
    deleted: number;
    cutoff: string;
}

/**
 * Retention enforcement — hard-deletes audit rows older than the cutoff.
 *
 * Hash-chain integrity:
 *   Purge intentionally breaks the `previousHash`/`entryHash` chain at the
 *   purge boundary. Verification tooling MUST treat pre-cutoff gaps as
 *   expected. See docs/compliance/audit-retention-policy.md "purge
 *   procedure" for the exact rule and the required `audit.batch_purged`
 *   self-audit event emitted by the orchestrating job.
 */
export class PurgeExpiredEntriesUseCase {
    constructor(private readonly repo: IAuditRepository) {}

    async execute(input: PurgeExpiredEntriesInput): Promise<PurgeExpiredEntriesResult> {
        const batchSize = input.batchSize ?? 500;
        const { items } = await this.repo.findExpired(input.tenantId, input.before, { limit: batchSize });
        if (items.length === 0) return { deleted: 0, cutoff: input.before.toISOString() };
        const ids = items.map((e) => e.entryId);
        const deleted = await this.repo.deleteBatch(input.tenantId, ids);
        return { deleted, cutoff: input.before.toISOString() };
    }
}
