import type { AuditEntry } from './audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface IAuditRepository {
    create(entry: AuditEntry): Promise<AuditEntry>;
    findByTenant(tenantId: TenantId, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<{
        items: AuditEntry[];
        cursor?: string;
    }>;
    findByAction(tenantId: TenantId, action: string, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<{
        items: AuditEntry[];
        cursor?: string;
    }>;
    getLastEntry(tenantId: TenantId): Promise<AuditEntry | null>;
}
