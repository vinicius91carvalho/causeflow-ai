import { RunbookRegistryEntity } from './entities/RunbookRegistryEntity.js';
import type { TenantId } from '../../domain/value-objects.js';
import type { RunbookEntry } from '../../domain/runbook-registry.entity.js';
import type { IRunbookRegistryRepository } from '../../domain/runbook-registry.repository.js';
export class DynamoRunbookRegistryRepository {
    async upsert(entry: RunbookEntry): Promise<RunbookEntry> {
        await RunbookRegistryEntity.upsert({
            tenantId: entry.tenantId,
            rootCauseHash: entry.rootCauseHash,
            rootCauseSummary: entry.rootCauseSummary,
            occurrences: entry.occurrences,
            confirmations: entry.confirmations,
            lastSeen: entry.lastSeen,
            fixAction: entry.fixAction,
            fixDescription: entry.fixDescription,
            automated: entry.automated,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        }).go();
        return entry;
    }
    async findByHash(tenantId: TenantId, rootCauseHash: string): Promise<RunbookEntry | null> {
        const result = await RunbookRegistryEntity.get({ tenantId: tenantId, rootCauseHash }).go();
        if (!result.data)
            return null;
        return this.toDomain(result.data);
    }
    async findEligible(tenantId: TenantId, minOccurrences: number = 5): Promise<RunbookEntry[]> {
        const result = await RunbookRegistryEntity.query.byTenant({ tenantId: tenantId }).go();
        return result.data
            .filter((r) => r.occurrences >= minOccurrences && r.confirmations >= 1)
            .map(this.toDomain);
    }
    async listByTenant(tenantId: TenantId): Promise<RunbookEntry[]> {
        const result = await RunbookRegistryEntity.query.byTenant({ tenantId: tenantId }).go();
        return result.data.map(this.toDomain);
    }
    toDomain(data: Record<string, any>) {
        return {
            tenantId: data['tenantId'],
            rootCauseHash: data['rootCauseHash'],
            rootCauseSummary: data['rootCauseSummary'],
            occurrences: data['occurrences'],
            confirmations: data['confirmations'],
            lastSeen: data['lastSeen'],
            fixAction: data['fixAction'],
            fixDescription: data['fixDescription'],
            automated: data['automated'],
            createdAt: data['createdAt'],
            updatedAt: data['updatedAt'],
        };
    }
}
