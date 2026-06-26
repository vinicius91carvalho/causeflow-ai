import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ApiKeyId, TenantId } from '../../../shared/domain/value-objects.js';
export class RevokeApiKeyUseCase {
    apiKeyRepo;
    eventBus;
    constructor(apiKeyRepo: IApiKeyRepository, eventBus: IEventBus) {
        this.apiKeyRepo = apiKeyRepo;
        this.eventBus = eventBus;
    }
    async execute(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey> {
        const revoked = await this.apiKeyRepo.revoke(tenantId, keyId);
        await this.eventBus.publish({
            eventType: 'apikey.revoked',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: { keyId: revoked.keyId, name: revoked.name },
        });
        return revoked;
    }
}
