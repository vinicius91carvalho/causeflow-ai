import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { ApiKeyId, TenantId } from '../../../shared/domain/value-objects.js';
export declare class DynamoApiKeyRepository implements IApiKeyRepository {
    create(apiKey: ApiKey): Promise<ApiKey>;
    findByHash(keyHash: string): Promise<ApiKey | null>;
    findById(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey | null>;
    listByTenant(tenantId: TenantId): Promise<ApiKey[]>;
    revoke(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey>;
}
