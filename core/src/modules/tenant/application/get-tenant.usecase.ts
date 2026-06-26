import { TenantNotFoundError } from '../domain/tenant.errors.js';
import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant } from '../domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export class GetTenantUseCase {
    repo;
    constructor(repo: ITenantRepository) {
        this.repo = repo;
    }
    async execute(id: TenantId): Promise<Tenant> {
        const tenant = await this.repo.findById(id);
        if (!tenant) {
            throw new TenantNotFoundError(id);
        }
        return tenant;
    }
}
