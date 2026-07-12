/**
 * Postgres API Key repository implementation for the OSS runtime (AC-040).
 */
import type { IApiKeyRepository } from '../domain/api-key.repository.js';
import type { ApiKey } from '../domain/api-key.entity.js';
import type { TenantId, ApiKeyId } from '../../../shared/domain/value-objects.js';
import {
  pgGet,
  pgInsert,
  pgDelete,
  pgQuery,
  pgQueryJson,
  pgUpdate,
} from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'api_keys';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): ApiKey {
  return {
    keyId: row.entity_id as unknown as ApiKeyId,
    tenantId: row.data['tenantId'] as unknown as TenantId,
    name: row.data['name'] as string,
    keyHash: row.data['keyHash'] as string,
    prefix: row.data['prefix'] as string,
    status: (row.data['status'] as ApiKey['status']) ?? 'active',
    scopes: row.data['scopes'] as string[] | undefined,
    webhookSecretHash: row.data['webhookSecretHash'] as string | undefined,
    createdBy: row.data['createdBy'] as string | undefined,
    createdByEmail: row.data['createdByEmail'] as string | undefined,
    lastUsedAt: row.data['lastUsedAt'] as string | undefined,
    revokedAt: row.data['revokedAt'] as string | undefined,
    createdAt: row.created_at,
  };
}

export class PgApiKeyRepository implements IApiKeyRepository {
  async create(apiKey: ApiKey): Promise<ApiKey> {
    const data: Record<string, unknown> = {
      tenantId: String(apiKey.tenantId),
      name: apiKey.name,
      keyHash: apiKey.keyHash,
      prefix: apiKey.prefix,
      status: apiKey.status,
      scopes: apiKey.scopes,
      webhookSecretHash: apiKey.webhookSecretHash,
      createdBy: apiKey.createdBy,
      createdByEmail: apiKey.createdByEmail,
      lastUsedAt: apiKey.lastUsedAt,
      revokedAt: apiKey.revokedAt,
    };
    const row = await pgInsert(TABLE, String(apiKey.tenantId), String(apiKey.keyId), data);
    return toDomain(row);
  }

  async findById(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey | null> {
    const row = await pgGet(TABLE, String(tenantId), String(keyId));
    if (!row) return null;
    return toDomain(row);
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const rows = await pgQueryJson(TABLE, "data->>'keyHash' = $1", [keyHash], { limit: 1 });
    if (rows.length === 0) return null;
    return toDomain(rows[0]);
  }

  async listByTenant(tenantId: TenantId): Promise<ApiKey[]> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [String(tenantId)]);
    return rows.map(toDomain);
  }

  async revoke(tenantId: TenantId, keyId: ApiKeyId): Promise<ApiKey> {
    const row = await pgUpdate(TABLE, String(tenantId), String(keyId), {
      revokedAt: new Date().toISOString(),
      status: 'revoked',
    });
    return toDomain(row);
  }

  async update(tenantId: TenantId, keyId: string, data: Partial<ApiKey>): Promise<ApiKey> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.revokedAt !== undefined) updateData['revokedAt'] = data.revokedAt;
    if (data.lastUsedAt !== undefined) updateData['lastUsedAt'] = data.lastUsedAt;
    const row = await pgUpdate(TABLE, String(tenantId), keyId, updateData);
    return toDomain(row);
  }

  async delete(tenantId: TenantId, keyId: string): Promise<void> {
    await pgDelete(TABLE, String(tenantId), keyId);
  }
}
