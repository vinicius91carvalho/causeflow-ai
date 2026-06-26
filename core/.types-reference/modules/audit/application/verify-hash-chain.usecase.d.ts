import type { IAuditRepository } from '../domain/audit.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface VerifyHashChainResult {
    valid: boolean;
    totalEntries: number;
    brokenAt?: string;
}
export declare class VerifyHashChainUseCase {
    private readonly repo;
    constructor(repo: IAuditRepository);
    execute(tenantId: TenantId): Promise<VerifyHashChainResult>;
}
