import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ITenantRepository } from '../domain/tenant.repository.js';
export declare class RefundCreditUseCase {
    private readonly repo;
    constructor(repo: ITenantRepository);
    execute(tenantId: TenantId): Promise<boolean>;
}
