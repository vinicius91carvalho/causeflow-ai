/**
 * Resolves the active Investigation LLM endpoint from a tenant's custom profile (AC-086).
 * AC-018: optional fallbackProfileId chain (max depth / cycle-safe); exhausted → fail closed.
 */
import { AesGcmTokenEncryption } from '../../../shared/infra/credentials/aes-gcm-token-encryption.js';
import type { ResolvedLlmEndpoint } from '../../../shared/infra/llm/llm-connector-profile.js';
import type { InvestigationLlmProfile } from '../domain/investigation-llm-profile.entity.js';
import { getActiveInvestigationLlmProfileId } from './investigation-llm-profile-active.store.js';
import { PgInvestigationLlmProfileRepository } from './pg-investigation-llm-profile.repository.js';

const DEFAULT_CONTEXT_WINDOW = 32_768;

/** AC-018: max hops along fallbackProfileId (includes the active profile). */
export const MAX_INVESTIGATION_LLM_FALLBACK_DEPTH = 5;

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

export const INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR =
  'Investigation LLM failed and the fallbackProfileId chain is missing or exhausted. Configure or fix the Investigation LLM in Settings — Core does not silently succeed via DeterministicLLMClient or Anthropic.';

export class NoActiveInvestigationLlmError extends Error {
  constructor() {
    super(NO_ACTIVE_INVESTIGATION_LLM_ERROR);
    this.name = 'NoActiveInvestigationLlmError';
  }
}

/** AC-018: fail closed when every profile in the chain is unreachable / failed. */
export class InvestigationLlmChainExhaustedError extends Error {
  constructor(message: string = INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR) {
    super(message);
    this.name = 'InvestigationLlmChainExhaustedError';
  }
}

export async function resolveActiveInvestigationLlmProfileEndpoint(
  tenantId: string,
): Promise<ResolvedLlmEndpoint | null> {
  const activeId = await getActiveInvestigationLlmProfileId(tenantId);
  if (!activeId) return null;
  return resolveInvestigationLlmProfileEndpoint(tenantId, activeId);
}

/**
 * AC-018: walk active profile → fallbackProfileId… with max depth and cycle protection.
 * Does not call DeterministicLLMClient or Anthropic.
 */
export async function resolveInvestigationLlmFallbackChain(
  tenantId: string,
  startProfileId: string,
): Promise<ResolvedLlmEndpoint[]> {
  const chain: ResolvedLlmEndpoint[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = startProfileId;
  let depth = 0;

  while (currentId && depth < MAX_INVESTIGATION_LLM_FALLBACK_DEPTH) {
    if (visited.has(currentId)) {
      // cycle-safe: stop without looping
      break;
    }
    visited.add(currentId);
    const profile = await getRepo().findById(tenantId, currentId);
    if (!profile) break;
    const endpoint = await resolveInvestigationLlmProfileEndpoint(tenantId, currentId);
    if (!endpoint) break;
    chain.push(endpoint);
    currentId = profile.fallbackProfileId;
    depth += 1;
  }

  return chain;
}

export async function resolveActiveInvestigationLlmFallbackChain(
  tenantId: string,
): Promise<ResolvedLlmEndpoint[]> {
  const activeId = await getActiveInvestigationLlmProfileId(tenantId);
  if (!activeId) return [];
  return resolveInvestigationLlmFallbackChain(tenantId, activeId);
}

/** AC-090: fail closed when OSS investigations have no active tenant profile. */
export async function assertActiveInvestigationLlmProfile(tenantId: string): Promise<void> {
  const endpoint = await resolveActiveInvestigationLlmProfileEndpoint(tenantId);
  if (!endpoint) {
    throw new NoActiveInvestigationLlmError();
  }
}
