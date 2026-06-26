import type { IAuditRepository } from '../domain/audit.repository.js';
import type { AuditEntry } from '../domain/audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface ExportAuditInput {
    tenantId: TenantId;
    action?: string;
    limit?: number;
}
export declare class ExportAuditUseCase {
    private readonly repo;
    constructor(repo: IAuditRepository);
    execute(input: ExportAuditInput): AsyncGenerator<AuditEntry>;
}
