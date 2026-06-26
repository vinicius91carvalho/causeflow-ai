import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export class ListApiKeysUseCase {
    apiKeyRepo;
    constructor(apiKeyRepo: IApiKeyRepository) {
        this.apiKeyRepo = apiKeyRepo;
    }
    async execute(tenantId: TenantId): Promise<ApiKey[]> {
        return this.apiKeyRepo.listByTenant(tenantId);
    }
}
