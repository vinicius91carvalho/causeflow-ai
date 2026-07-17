import { describe, expect, it } from 'vitest';
import {
  getInvestigationLlmProfilePreset,
  INVESTIGATION_LLM_PROFILE_PRESETS,
  ORNITH_API_PRESET,
  ORNITH_LOCAL_PRESET,
} from '@/contexts/settings/domain/investigation-llm-profile-presets';

describe('investigation-llm-profile-presets (AC-087)', () => {
  it('ships Ornith local and API example presets', () => {
    expect(INVESTIGATION_LLM_PROFILE_PRESETS).toHaveLength(2);
    expect(INVESTIGATION_LLM_PROFILE_PRESETS.map((preset) => preset.id)).toEqual([
      'ornith-local',
      'ornith-api',
    ]);
  });

  it('Ornith (local) uses llama.cpp defaults on :8081 via host.docker.internal', () => {
    expect(ORNITH_LOCAL_PRESET.label).toBe('Ornith (local)');
    expect(ORNITH_LOCAL_PRESET.baseUrl).toBe('http://host.docker.internal:8081/v1');
    expect(ORNITH_LOCAL_PRESET.model).toBe('Ornith-1.0-9B-code');
    expect(ORNITH_LOCAL_PRESET.contextWindowTokens).toBe(32_768);
  });

  it('Ornith (API) uses remote OpenAI-compatible defaults', () => {
    expect(ORNITH_API_PRESET.label).toBe('Ornith (API)');
    expect(ORNITH_API_PRESET.baseUrl).toMatch(/^https:\/\//);
    expect(ORNITH_API_PRESET.model).toBe('Ornith-1.0-9B');
    expect(ORNITH_API_PRESET.contextWindowTokens).toBe(262_144);
  });

  it('resolves presets by id', () => {
    expect(getInvestigationLlmProfilePreset('ornith-local')).toEqual(ORNITH_LOCAL_PRESET);
    expect(getInvestigationLlmProfilePreset('ornith-api')).toEqual(ORNITH_API_PRESET);
  });
});
