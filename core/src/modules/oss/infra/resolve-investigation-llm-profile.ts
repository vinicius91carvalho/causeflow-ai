/**
 * Resolves the active Investigation LLM endpoint from a tenant's custom profile (AC-086).
 */
import { AesGcmTokenEncryption } from '../../../shared/infra/credentials/aes-gcm-token-encryption.js';
import type { ResolvedLlmEndpoint } from '../../../shared/infra/llm/llm-connector-profile.js';
import type { InvestigationLlmProfile } from '../domain/investigation-llm-profile.entity.js';
import { getActiveInvestigationLlmProfileId } from './investigation-llm-profile-active.store.js';
import { PgInvestigationLlmProfileRepository } from './pg-investigation-llm-profile.repository.js';

const DEFAULT_CONTEXT_WINDOW = 32_768;

let repo: PgInvestigationLlmProfileRepository | null = null;
let encryption: AesGcmTokenEncryption | null = null;

function getRepo(): PgInvestigationLlmProfileRepository {
  if (!repo) repo = new PgInvestigationLlmProfileRepository();
  return repo;
}

function getEncryption(): AesGcmTokenEncryption {
  if (!encryption) encryption = new AesGcmTokenEncryption();
  return encryption;
}

async function decryptApiKey(profile: InvestigationLlmProfile): Promise<string> {
  if (!profile.apiKeyEncrypted) return 'local';
  return getEncryption().decrypt(profile.apiKeyEncrypted);
}

export async function resolveInvestigationLlmProfileEndpoint(
  tenantId: string,
  profileId: string,
): Promise<ResolvedLlmEndpoint | null> {
  const profile = await getRepo().findById(tenantId, profileId);
  if (!profile) return null;
  const apiKey = await decryptApiKey(profile);
  return {
    connectorId: profile.id,
    profileId: profile.id,
    label: profile.label,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKey,
    contextWindowTokens: profile.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW,
    credentialsConfigured: Boolean(profile.apiKeyEncrypted) || apiKey.length > 0,
  };
}

export const NO_ACTIVE_INVESTIGATION_LLM_ERROR =
  'No Investigation LLM profile is active. Configure an Investigation LLM in Settings before starting an investigation.';

export class NoActiveInvestigationLlmError extends Error {
  constructor() {
    super(NO_ACTIVE_INVESTIGATION_LLM_ERROR);
    this.name = 'NoActiveInvestigationLlmError';
  }
}

export async function resolveActiveInvestigationLlmProfileEndpoint(
  tenantId: string,
): Promise<ResolvedLlmEndpoint | null> {
  const activeId = await getActiveInvestigationLlmProfileId(tenantId);
  if (!activeId) return null;
  return resolveInvestigationLlmProfileEndpoint(tenantId, activeId);
}

/** AC-090: fail closed when OSS investigations have no active tenant profile. */
export async function assertActiveInvestigationLlmProfile(tenantId: string): Promise<void> {
  const endpoint = await resolveActiveInvestigationLlmProfileEndpoint(tenantId);
  if (!endpoint) {
    throw new NoActiveInvestigationLlmError();
  }
}
