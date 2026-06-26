import type { IAuditRepository } from '../domain/audit.repository.js';
import type { AuditEntry } from '../domain/audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class DynamoAuditRepository implements IAuditRepository {
    create(entry: AuditEntry): Promise<AuditEntry>;
    findByTenant(tid: TenantId, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<{
        items: AuditEntry[];
        cursor?: string;
    }>;
    findByAction(tid: TenantId, action: string, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<{
        items: AuditEntry[];
        cursor?: string;
    }>;
    getLastEntry(tid: TenantId): Promise<AuditEntry | null>;
}
