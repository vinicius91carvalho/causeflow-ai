/**
 * OSS investigation LLM connector profiles (AC-059).
 * Pure domain types — no external imports.
 */

export type LlmConnectorId = 'ornith' | 'deepseek-opencode' | 'deepseek-nim';

export interface LlmConnectorProfile {
  id: LlmConnectorId;
  label: string;
  baseUrl: string;
  model: string;
  /** Approximate context window for operator guidance. */
  contextWindowTokens: number;
  /** Whether runtime credentials are present (never exposes secret values). */
  credentialsConfigured: boolean;
}

export interface LlmConnectorOption {
  id: LlmConnectorId;
  label: string;
  model: string;
  contextWindowTokens: number;
  credentialsConfigured: boolean;
}

/** Documented signal when Ornith's ~32k window is exceeded (AC-059). */
export const LLM_CONTEXT_TOO_LARGE_CODE = 'LLM_CONTEXT_TOO_LARGE';

export const ORNITH_CONTEXT_WINDOW_TOKENS = 32_768;

export const DEEPSEEK_CONTEXT_WINDOW_TOKENS = 128_000;
