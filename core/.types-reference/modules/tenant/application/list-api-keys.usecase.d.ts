import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class ListApiKeysUseCase {
    private readonly apiKeyRepo;
    constructor(apiKeyRepo: IApiKeyRepository);
    execute(tenantId: TenantId): Promise<ApiKey[]>;
}
