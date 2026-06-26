import type { IAuditRepository } from '../domain/audit.repository.js';
import type { AuditEntry } from '../domain/audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface ListAuditEntriesInput {
    tenantId: TenantId;
    action?: string;
    limit?: number;
    cursor?: string;
}
export declare class ListAuditEntriesUseCase {
    private readonly repo;
    constructor(repo: IAuditRepository);
    execute(input: ListAuditEntriesInput): Promise<{
        items: AuditEntry[];
        cursor?: string;
    }>;
}
