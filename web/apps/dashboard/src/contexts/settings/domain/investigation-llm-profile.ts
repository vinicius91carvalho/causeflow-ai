/**
 * OSS custom Investigation LLM profile types (AC-084).
 * Mirrors Core GET/POST /v1/oss/investigation-llm-profiles — no framework imports.
 */

export interface InvestigationLlmProfile {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  contextWindowTokens?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationLlmProfilesResponse {
  items: InvestigationLlmProfile[];
}

export interface CreateInvestigationLlmProfileInput {
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindowTokens?: number;
}
