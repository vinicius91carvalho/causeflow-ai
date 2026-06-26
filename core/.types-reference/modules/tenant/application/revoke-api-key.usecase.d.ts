import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ApiKeyId, TenantId } from '../../../shared/domain/value-objects.js';
export declare class RevokeApiKeyUseCase {
    private readonly apiKeyRepo;
    private readonly eventBus;
    constructor(apiKeyRepo: IApiKeyRepository, eventBus: IEventBus);
    execute(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey>;
}
