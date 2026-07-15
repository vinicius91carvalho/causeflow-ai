/**
 * OSS custom Investigation LLM profile (AC-084+).
 * OpenAI-compatible provider config persisted per tenant.
 */
import type { EncryptedPayload } from '../../../shared/application/ports/token-encryption.port.js';

export interface InvestigationLlmProfile {
  id: string;
  tenantId: string;
  label: string;
  baseUrl: string;
  model: string;
  apiKeyEncrypted?: EncryptedPayload;
  contextWindowTokens?: number;
  createdAt: string;
  updatedAt: string;
}

/** Safe representation — never includes the raw API key. */
export interface InvestigationLlmProfilePublic {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  contextWindowTokens?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPublicInvestigationLlmProfile(
  profile: InvestigationLlmProfile,
  options?: { isActive?: boolean },
): InvestigationLlmProfilePublic {
  return {
    id: profile.id,
    label: profile.label,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKeyConfigured: Boolean(profile.apiKeyEncrypted),
    contextWindowTokens: profile.contextWindowTokens,
    isActive: options?.isActive,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
