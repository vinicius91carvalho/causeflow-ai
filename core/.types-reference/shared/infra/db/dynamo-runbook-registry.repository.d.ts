import type { TenantId } from '../../domain/value-objects.js';
import type { RunbookEntry } from '../../domain/runbook-registry.entity.js';
import type { IRunbookRegistryRepository } from '../../domain/runbook-registry.repository.js';
export declare class DynamoRunbookRegistryRepository implements IRunbookRegistryRepository {
    upsert(entry: RunbookEntry): Promise<RunbookEntry>;
    findByHash(tenantId: TenantId, rootCauseHash: string): Promise<RunbookEntry | null>;
    findEligible(tenantId: TenantId, minOccurrences?: number): Promise<RunbookEntry[]>;
    listByTenant(tenantId: TenantId): Promise<RunbookEntry[]>;
    private toDomain;
}
