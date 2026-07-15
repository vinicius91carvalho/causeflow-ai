/**
 * OSS custom Investigation LLM profile types (AC-084, AC-085).
 * Mirrors Core GET/POST/PATCH/DELETE /v1/oss/investigation-llm-profiles — no framework imports.
 */

export interface InvestigationLlmProfile {
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

export interface InvestigationLlmProfilesResponse {
  items: InvestigationLlmProfile[];
  activeProfileId?: string | null;
}

export interface ActivateInvestigationLlmProfileResponse {
  activeProfileId: string;
  profile: InvestigationLlmProfile;
}

export interface CreateInvestigationLlmProfileInput {
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindowTokens?: number;
}

export interface UpdateInvestigationLlmProfileInput {
  label?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  contextWindowTokens?: number | null;
}
