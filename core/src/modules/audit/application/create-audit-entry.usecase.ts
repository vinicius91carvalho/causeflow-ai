import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { auditEntryId } from '../../../shared/domain/value-objects.js';
import type { IAuditRepository } from '../domain/audit.repository.js';
import type { AuditEntry, AuditActorType, AuditEvidence } from '../domain/audit.entity.js';
import type { AuditAction } from '../../../shared/domain/types.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface CreateAuditEntryInput {
    tenantId: TenantId;
    action: AuditAction;
    actorType: AuditActorType;
    /**
     * Canonical subject identifier (JWT sub). Primary attribution key.
     * Not included in hash payload — see docs/compliance/audit-retention-policy.md Section 5.
     */
    actorUserId?: string;
    actorEmail: string;
    resourceType: string;
    resourceId: string;
    changes?: Record<string, unknown>;
    evidences?: AuditEvidence[];
}

function computeHash(data: string) {
    return createHash('sha256').update(data).digest('hex');
}
export class CreateAuditEntryUseCase {
    repo;
    constructor(repo: IAuditRepository) {
        this.repo = repo;
    }
    async execute(input: CreateAuditEntryInput): Promise<AuditEntry> {
        const lastEntry = await this.repo.getLastEntry(input.tenantId);
        const previousHash = lastEntry?.entryHash ?? '0'.repeat(64);
        const entryId = auditEntryId(uuidv4());
        const now = new Date().toISOString();
        const changesStr = input.changes ? JSON.stringify(input.changes) : undefined;
        const hashPayload = [
            previousHash,
            input.tenantId,
            entryId,
            input.action,
            input.actorEmail,
            input.resourceType,
            input.resourceId,
            changesStr ?? '',
            now,
        ].join('|');
        const entryHash = computeHash(hashPayload);
        const entry: AuditEntry = {
            tenantId: input.tenantId,
            entryId,
            action: input.action,
            actorType: input.actorType,
            ...(input.actorUserId !== undefined && { actorUserId: input.actorUserId }),
            actorEmail: input.actorEmail,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            changes: changesStr,
            ...(input.evidences !== undefined && { evidences: input.evidences }),
            previousHash,
            entryHash,
            createdAt: now,
        };
        return this.repo.create(entry);
    }
}
