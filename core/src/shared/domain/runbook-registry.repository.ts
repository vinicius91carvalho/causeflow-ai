import type { TenantId } from './value-objects.js';
import type { RunbookEntry } from './runbook-registry.entity.js';
export interface IRunbookRegistryRepository {
    upsert(entry: RunbookEntry): Promise<RunbookEntry>;
    findByHash(tenantId: TenantId, rootCauseHash: string): Promise<RunbookEntry | null>;
    findEligible(tenantId: TenantId, minOccurrences?: number): Promise<RunbookEntry[]>;
    listByTenant(tenantId: TenantId): Promise<RunbookEntry[]>;
}
