/**
 * Example Investigation LLM profile presets (AC-087).
 * Helpers for operators — not a mandatory provider catalog.
 */

export type InvestigationLlmProfilePresetId = 'ornith-local' | 'ornith-api';

export interface InvestigationLlmProfilePreset {
  id: InvestigationLlmProfilePresetId;
  label: string;
  baseUrl: string;
  model: string;
  contextWindowTokens?: number;
}

/** Local llama.cpp / llama-session Ornith on :8081 (AC-057). */
export const ORNITH_LOCAL_PRESET: InvestigationLlmProfilePreset = {
  id: 'ornith-local',
  label: 'Ornith (local)',
  baseUrl: 'http://127.0.0.1:8081/v1',
  model: 'Ornith-1.0-9B-code',
  contextWindowTokens: 32_768,
};

/** Remote vLLM / SGLang OpenAI-compatible Ornith endpoint (operator supplies host + API key). */
export const ORNITH_API_PRESET: InvestigationLlmProfilePreset = {
  id: 'ornith-api',
  label: 'Ornith (API)',
  baseUrl: 'https://your-ornith-host.example.com/v1',
  model: 'Ornith-1.0-9B',
  contextWindowTokens: 262_144,
};

export const INVESTIGATION_LLM_PROFILE_PRESETS: InvestigationLlmProfilePreset[] = [
  ORNITH_LOCAL_PRESET,
  ORNITH_API_PRESET,
];

export function getInvestigationLlmProfilePreset(
  id: InvestigationLlmProfilePresetId,
): InvestigationLlmProfilePreset | undefined {
  return INVESTIGATION_LLM_PROFILE_PRESETS.find((preset) => preset.id === id);
}
