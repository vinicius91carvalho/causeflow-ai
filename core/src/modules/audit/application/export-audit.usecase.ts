import type { IAuditRepository } from '../domain/audit.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface ExportAuditInput {
    tenantId: TenantId;
    action?: string;
    limit?: number;
}

export class ExportAuditUseCase {
    repo;
    constructor(repo: IAuditRepository) {
        this.repo = repo;
    }
    async *execute(input: ExportAuditInput) {
        const pageSize = 100;
        let cursor: string | undefined;
        do {
            const result = input.action
                ? await this.repo.findByAction(input.tenantId, input.action, {
                    limit: pageSize,
                    cursor,
                })
                : await this.repo.findByTenant(input.tenantId, {
                    limit: pageSize,
                    cursor,
                });
            for (const entry of result.items) {
                yield entry;
            }
            cursor = result.cursor;
        } while (cursor);
    }
}
