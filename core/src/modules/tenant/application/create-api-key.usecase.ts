import { randomBytes, createHash } from 'node:crypto';
import { apiKeyId } from '../../../shared/domain/value-objects.js';
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

export class CreateApiKeyUseCase {
    apiKeyRepo;
    eventBus;
    constructor(apiKeyRepo: IApiKeyRepository, eventBus: IEventBus) {
        this.apiKeyRepo = apiKeyRepo;
        this.eventBus = eventBus;
    }
    async execute(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
        const rawKey = randomBytes(32).toString('hex');
        const plaintext = `cflo_${rawKey}`;
        const keyHash = createHash('sha256').update(plaintext).digest('hex');
        const prefix = plaintext.slice(0, 8);
        // Generate per-key webhook secret
        const webhookSecret = randomBytes(32).toString('hex');
        const webhookSecretHash = createHash('sha256').update(webhookSecret).digest('hex');
        const apiKey = {
            keyId: apiKeyId(randomBytes(16).toString('hex')),
            tenantId: input.tenantId,
            name: input.name,
            keyHash,
            prefix,
            status: 'active',
            webhookSecretHash,
            createdAt: new Date().toISOString(),
        };
        const created = await this.apiKeyRepo.create(apiKey as ApiKey);
        await this.eventBus.publish({
            eventType: 'apikey.created',
            occurredAt: new Date().toISOString(),
            tenantId: input.tenantId,
            payload: { keyId: created.keyId, name: created.name, prefix },
        });
        return { apiKey: created, plaintext, webhookSecret };
    }
}
