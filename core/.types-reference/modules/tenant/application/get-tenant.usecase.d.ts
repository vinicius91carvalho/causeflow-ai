import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant } from '../domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class GetTenantUseCase {
    private readonly repo;
    constructor(repo: ITenantRepository);
    execute(id: TenantId): Promise<Tenant>;
}
