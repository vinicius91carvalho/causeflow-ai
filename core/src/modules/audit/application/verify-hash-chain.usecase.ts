import { createHash } from 'node:crypto';
import { AuditHashChainBrokenError } from '../domain/audit.errors.js';
import type { IAuditRepository } from '../domain/audit.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface VerifyHashChainResult {
    valid: boolean;
    totalEntries: number;
    brokenAt?: string;
}

function computeHash(data: string) {
    return createHash('sha256').update(data).digest('hex');
}
export class VerifyHashChainUseCase {
    repo;
    constructor(repo: IAuditRepository) {
        this.repo = repo;
    }
    async execute(tenantId: TenantId): Promise<VerifyHashChainResult> {
        let cursor;
        let totalEntries = 0;
        let previousHash = '0'.repeat(64);
        do {
            const page = await this.repo.findByTenant(tenantId, { limit: 100, cursor });
            for (const entry of page.items) {
                totalEntries++;
                if (entry.previousHash !== previousHash) {
                    throw new AuditHashChainBrokenError(entry.entryId, previousHash, entry.previousHash);
                }
                const hashPayload = [
                    entry.previousHash,
                    entry.tenantId,
                    entry.entryId,
                    entry.action,
                    entry.actorEmail,
                    entry.resourceType,
                    entry.resourceId,
                    entry.changes ?? '',
                    entry.createdAt,
                ].join('|');
                const expectedHash = computeHash(hashPayload);
                if (entry.entryHash !== expectedHash) {
                    throw new AuditHashChainBrokenError(entry.entryId, expectedHash, entry.entryHash);
                }
                previousHash = entry.entryHash;
            }
            cursor = page.cursor;
        } while (cursor);
        return { valid: true, totalEntries };
    }
}
