import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { Tenant } from '../../tenant/domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class LazyRenewalUseCase {
    private readonly tenantRepo;
    constructor(tenantRepo: ITenantRepository);
    execute(tenantId: TenantId): Promise<Tenant>;
}
