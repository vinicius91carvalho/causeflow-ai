import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface CreateApiKeyInput {
    tenantId: TenantId;
    name: string;
}
export interface CreateApiKeyResult {
    apiKey: ApiKey;
    plaintext: string;
    webhookSecret: string;
}
export declare class CreateApiKeyUseCase {
    private readonly apiKeyRepo;
    private readonly eventBus;
    constructor(apiKeyRepo: IApiKeyRepository, eventBus: IEventBus);
    execute(input: CreateApiKeyInput): Promise<CreateApiKeyResult>;
}
