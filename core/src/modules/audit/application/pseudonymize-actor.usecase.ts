import { createHash } from 'node:crypto';
import type { IAuditRepository } from '../domain/audit.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface PseudonymizeActorInput {
    tenantId: TenantId;
    /** Canonical JWT sub of the subject exercising right-to-erasure. */
    actorUserId: string;
    /**
     * Tenant-scoped secret used to salt the pseudonym hash. MUST be
     * stable per tenant so subsequent erasures of related events yield
     * the same pseudonym (enabling correlation for legal claims) but
     * MUST NOT be globally guessable.
     */
    tenantSecret: string;
}

export interface PseudonymizeActorResult {
    pseudonym: string;
    mutatedRows: number;
}

/**
 * Right-to-erasure (LGPD art. 7º II/IX, GDPR art. 17) implementation.
 *
 * Hash-chain integrity contract:
 *   `entryHash` is computed from [previousHash, tenantId, entryId, action,
 *   actorEmail, resourceType, resourceId, changes, createdAt]. `actorUserId`
 *   is deliberately NOT part of that payload — see
 *   create-audit-entry.usecase.ts — so replacing it leaves the chain valid.
 *
 *   `actorEmail` IS in the hash payload; pseudonymization therefore
 *   preserves it untouched. Operators accept this residual linkage as
 *   documented in docs/compliance/audit-retention-policy.md under
 *   "hash-chain integrity rules".
 */
export class PseudonymizeActorUseCase {
    constructor(private readonly repo: IAuditRepository) {}

    async execute(input: PseudonymizeActorInput): Promise<PseudonymizeActorResult> {
        const pseudonym = 'erased:' + createHash('sha256')
            .update(input.actorUserId + '|' + input.tenantSecret)
            .digest('hex');
        const mutatedRows = await this.repo.pseudonymizeActor(
            input.tenantId,
            input.actorUserId,
            pseudonym,
        );
        return { pseudonym, mutatedRows };
    }
}
