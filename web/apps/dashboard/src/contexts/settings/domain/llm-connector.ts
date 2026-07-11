/**
 * OSS investigation LLM connector types (AC-059).
 * Mirrors Core `GET/PUT /v1/oss/llm-connector` — no framework imports.
 */

export type LlmConnectorId = 'ornith' | 'deepseek-opencode' | 'deepseek-nim';

export interface LlmConnectorActive {
  id: LlmConnectorId;
  label: string;
  model: string;
  baseUrl: string;
  contextWindowTokens: number;
  credentialsConfigured: boolean;
}

export interface LlmConnectorOption {
  id: LlmConnectorId;
  label: string;
  model: string;
  contextWindowTokens: number;
  credentialsConfigured: boolean;
}

export interface LlmConnectorResponse {
  active: LlmConnectorActive;
  options: LlmConnectorOption[];
  contextOverflowCode: string;
  credentialSources: string[];
}

/** Documented Core signal when Ornith's ~32k window is exceeded. */
export const LLM_CONTEXT_TOO_LARGE_CODE = 'LLM_CONTEXT_TOO_LARGE';

export const LLM_CONNECTOR_IDS: readonly LlmConnectorId[] = [
  'ornith',
  'deepseek-opencode',
  'deepseek-nim',
] as const;
