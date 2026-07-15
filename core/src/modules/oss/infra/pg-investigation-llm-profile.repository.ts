/**
 * Postgres repository for OSS Investigation LLM profiles (AC-084).
 */
import type { EncryptedPayload } from '../../../shared/application/ports/token-encryption.port.js';
import {
  pgGet,
  pgInsert,
  pgQuery,
  type PgEntityRow,
} from '../../../shared/infra/db/postgres/pg-utils.js';
import type { InvestigationLlmProfile } from '../domain/investigation-llm-profile.entity.js';

const TABLE = 'investigation_llm_profiles';

function toDomain(row: PgEntityRow): InvestigationLlmProfile {
  const data = row.data;
  return {
    id: row.entity_id,
    tenantId: row.tenant_id,
    label: data['label'] as string,
    baseUrl: data['baseUrl'] as string,
    model: data['model'] as string,
    apiKeyEncrypted: data['apiKeyEncrypted'] as EncryptedPayload | undefined,
    contextWindowTokens: data['contextWindowTokens'] as number | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgInvestigationLlmProfileRepository {
  async create(profile: Omit<InvestigationLlmProfile, 'createdAt' | 'updatedAt'>): Promise<InvestigationLlmProfile> {
    const data: Record<string, unknown> = {
      label: profile.label,
      baseUrl: profile.baseUrl,
      model: profile.model,
    };
    if (profile.apiKeyEncrypted) {
      data['apiKeyEncrypted'] = profile.apiKeyEncrypted;
    }
    if (profile.contextWindowTokens !== undefined) {
      data['contextWindowTokens'] = profile.contextWindowTokens;
    }
    const row = await pgInsert(TABLE, profile.tenantId, profile.id, data);
    return toDomain(row);
  }

  async findById(tenantId: string, profileId: string): Promise<InvestigationLlmProfile | null> {
    const row = await pgGet(TABLE, tenantId, profileId);
    if (!row) return null;
    return toDomain(row);
  }

  async listByTenant(tenantId: string): Promise<InvestigationLlmProfile[]> {
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [tenantId]);
    return rows.map(toDomain).sort((a, b) => a.label.localeCompare(b.label));
  }
}
