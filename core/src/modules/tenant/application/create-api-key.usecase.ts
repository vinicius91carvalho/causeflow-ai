import { randomBytes, createHash } from 'node:crypto';
import { apiKeyId } from '../../../shared/domain/value-objects.js';
import { QuotaExceededError } from '../../../shared/domain/errors.js';
import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

/** Per-tenant cap on active API keys (programmatic access principals). */
export const MAX_API_KEYS_PER_TENANT = Number(process.env['MAX_API_KEYS_PER_TENANT'] ?? 5);

export interface CreateApiKeyInput {
  tenantId: TenantId;
  name: string;
  scopes?: string[];
  createdBy?: string;
  createdByEmail?: string;
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
    // Per-tenant active-key quota. Revoked keys don't count against the cap.
    const existing = (await this.apiKeyRepo.listByTenant(input.tenantId)) ?? [];
    const activeCount = existing.filter((k) => k.status === 'active').length;
    if (activeCount >= MAX_API_KEYS_PER_TENANT) {
      throw new QuotaExceededError(
        `API key quota exceeded for tenant (limit=${MAX_API_KEYS_PER_TENANT})`,
        { limit: MAX_API_KEYS_PER_TENANT, active: activeCount },
      );
    }
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
      scopes: input.scopes,
      webhookSecretHash,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
      createdByEmail: input.createdByEmail,
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
