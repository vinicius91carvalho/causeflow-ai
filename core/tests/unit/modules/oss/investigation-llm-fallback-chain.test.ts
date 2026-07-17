import { describe, expect, it, vi, beforeEach } from 'vitest';

const findById = vi.fn();
const getActiveInvestigationLlmProfileId = vi.fn();

vi.mock('../../../../src/modules/oss/infra/pg-investigation-llm-profile.repository.js', () => ({
  PgInvestigationLlmProfileRepository: class {
    findById = findById;
  },
}));

vi.mock('../../../../src/modules/oss/infra/investigation-llm-profile-active.store.js', () => ({
  getActiveInvestigationLlmProfileId: (...args: unknown[]) =>
    getActiveInvestigationLlmProfileId(...args),
}));

vi.mock('../../../../src/shared/infra/credentials/aes-gcm-token-encryption.js', () => ({
  AesGcmTokenEncryption: class {
    decrypt = vi.fn().mockResolvedValue('local');
  },
}));

import {
  INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR,
  InvestigationLlmChainExhaustedError,
  MAX_INVESTIGATION_LLM_FALLBACK_DEPTH,
  resolveActiveInvestigationLlmFallbackChain,
  resolveInvestigationLlmFallbackChain,
} from '../../../../src/modules/oss/infra/resolve-investigation-llm-profile.js';

function profile(id: string, fallbackProfileId?: string) {
  return {
    id,
    tenantId: 'tenant-1',
    label: id,
    baseUrl: `http://llm.local/${id}/v1`,
    model: 'model',
    fallbackProfileId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('investigation LLM fallbackProfileId chain (AC-018)', () => {
  beforeEach(() => {
    findById.mockReset();
    getActiveInvestigationLlmProfileId.mockReset();
  });

  it('exposes max-depth constant and clear configure/fix-LLM exhausted error', () => {
    expect(MAX_INVESTIGATION_LLM_FALLBACK_DEPTH).toBeGreaterThanOrEqual(2);
    expect(INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR).toMatch(/Configure or fix the Investigation LLM/);
    expect(INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR).toMatch(/DeterministicLLMClient/);
    expect(INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR).toMatch(/Anthropic/);
    expect(new InvestigationLlmChainExhaustedError().message).toBe(
      INVESTIGATION_LLM_CHAIN_EXHAUSTED_ERROR,
    );
  });

  it('walks optional fallbackProfileId chain in order', async () => {
    findById.mockImplementation(async (_tenant: string, id: string) => {
      if (id === 'a') return profile('a', 'b');
      if (id === 'b') return profile('b', 'c');
      if (id === 'c') return profile('c');
      return null;
    });

    const chain = await resolveInvestigationLlmFallbackChain('tenant-1', 'a');
    expect(chain.map((e) => e.profileId)).toEqual(['a', 'b', 'c']);
  });

  it('is cycle-safe (does not loop forever)', async () => {
    findById.mockImplementation(async (_tenant: string, id: string) => {
      if (id === 'a') return profile('a', 'b');
      if (id === 'b') return profile('b', 'a');
      return null;
    });

    const chain = await resolveInvestigationLlmFallbackChain('tenant-1', 'a');
    expect(chain.map((e) => e.profileId)).toEqual(['a', 'b']);
  });

  it('stops at MAX_INVESTIGATION_LLM_FALLBACK_DEPTH', async () => {
    findById.mockImplementation(async (_tenant: string, id: string) => {
      const n = Number(id);
      return profile(id, String(n + 1));
    });

    const chain = await resolveInvestigationLlmFallbackChain('tenant-1', '0');
    expect(chain).toHaveLength(MAX_INVESTIGATION_LLM_FALLBACK_DEPTH);
    expect(chain[0]?.profileId).toBe('0');
  });

  it('returns empty chain when no active profile (missing chain)', async () => {
    getActiveInvestigationLlmProfileId.mockResolvedValue(null);
    await expect(resolveActiveInvestigationLlmFallbackChain('tenant-1')).resolves.toEqual([]);
  });
});
