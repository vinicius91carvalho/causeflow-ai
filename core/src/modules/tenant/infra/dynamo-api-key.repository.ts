import { apiKeyId } from '../../../shared/domain/value-objects.js';
import { ApiKeyEntity } from '../../../shared/infra/db/entities/ApiKeyEntity.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { ApiKeyId, TenantId } from '../../../shared/domain/value-objects.js';
function toDomain(raw: Record<string, any>) {
  return {
    keyId: apiKeyId(raw['keyId']),
    tenantId: raw['tenantId'],
    name: raw['name'],
    keyHash: raw['keyHash'],
    prefix: raw['prefix'],
    status: raw['status'],
    scopes: raw['scopes'],
    webhookSecretHash: raw['webhookSecretHash'],
    lastUsedAt: raw['lastUsedAt'],
    revokedAt: raw['revokedAt'],
    createdAt: raw['createdAt'],
    createdBy: raw['createdBy'],
    createdByEmail: raw['createdByEmail'],
  };
}
export class DynamoApiKeyRepository {
  async create(apiKey: ApiKey): Promise<ApiKey> {
    const result = await ApiKeyEntity.create({
      keyId: apiKey.keyId,
      tenantId: apiKey.tenantId,
      name: apiKey.name,
      keyHash: apiKey.keyHash,
      prefix: apiKey.prefix,
      status: apiKey.status,
      scopes: apiKey.scopes,
      createdBy: apiKey.createdBy,
      createdByEmail: apiKey.createdByEmail,
    }).go();
    return toDomain(result.data);
  }
  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const result = await ApiKeyEntity.get({ keyHash }).go();
    if (!result.data) return null;
    return toDomain(result.data);
  }
  async findById(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey | null> {
    const result = await ApiKeyEntity.query.byTenant({ tenantId, keyId }).go();
    if (result.data.length === 0) return null;
    return toDomain(result.data[0]!);
  }
  async listByTenant(tenantId: TenantId): Promise<ApiKey[]> {
    const result = await ApiKeyEntity.query.byTenant({ tenantId }).go();
    return result.data.map((item) => toDomain(item));
  }
  async revoke(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey> {
    const existing = await this.findById(tenantId, keyId);
    if (!existing) {
      throw new NotFoundError('ApiKey', keyId);
    }
    const result = await ApiKeyEntity.patch({ keyHash: existing.keyHash })
      .set({ status: 'revoked', revokedAt: new Date().toISOString() })
      .go({ response: 'all_new' });
    return toDomain(result.data);
  }
}
