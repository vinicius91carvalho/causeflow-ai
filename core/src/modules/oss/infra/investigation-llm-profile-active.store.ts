/**
 * Per-tenant active Investigation LLM profile id (AC-086).
 * Stored on the tenant row so API and worker share durable state.
 */
import { pgGet, pgUpdate } from '../../../shared/infra/db/postgres/pg-utils.js';

const TENANTS_TABLE = 'tenants';
const TENANT_ENTITY_ID = 'tenant';
const ACTIVE_PROFILE_FIELD = 'activeInvestigationLlmProfileId';

export async function getActiveInvestigationLlmProfileId(
  tenantId: string,
): Promise<string | null> {
  const row = await pgGet(TENANTS_TABLE, tenantId, TENANT_ENTITY_ID);
  if (!row) return null;
  const raw = row.data[ACTIVE_PROFILE_FIELD];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

export async function setActiveInvestigationLlmProfileId(
  tenantId: string,
  profileId: string,
): Promise<void> {
  await pgUpdate(TENANTS_TABLE, tenantId, TENANT_ENTITY_ID, {
    [ACTIVE_PROFILE_FIELD]: profileId,
  });
}

export async function clearActiveInvestigationLlmProfileId(tenantId: string): Promise<void> {
  await pgUpdate(TENANTS_TABLE, tenantId, TENANT_ENTITY_ID, {
    [ACTIVE_PROFILE_FIELD]: null,
  });
}
