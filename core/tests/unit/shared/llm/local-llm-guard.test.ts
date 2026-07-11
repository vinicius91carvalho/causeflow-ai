import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    isOss: () => false,
    isDev: () => false,
    isTest: () => true,
    logLevel: 'silent',
    llm: {
      connector: 'ornith',
      ornithBaseUrl: 'http://127.0.0.1:8081/v1',
      ornithModel: 'Ornith-1.0-9B-code',
      ornithApiKey: 'local',
      opencodeBaseUrl: 'https://opencode.ai/zen/go/v1',
      opencodeModel: 'deepseek-v4-flash-free',
      opencodeApiKey: '',
      nimBaseUrl: 'https://integrate.api.nvidia.com/v1',
      nimModel: 'deepseek-ai/deepseek-v4-flash',
      nimApiKey: '',
      get baseUrl() {
        return this.ornithBaseUrl;
      },
      get model() {
        return this.ornithModel;
      },
      get apiKey() {
        return this.ornithApiKey;
      },
    },
  },
}));

vi.mock('../../../../src/shared/infra/cache/redis-client.js', () => ({
  getRedisClient: () => ({
    get: async () => null,
    set: async () => 'OK',
  }),
}));

import {
  LOCAL_LLM_UNAVAILABLE_MESSAGE,
  assertLocalLlmReachable,
  probeLocalLlmReachable,
} from '../../../../src/shared/infra/llm/local-llm-guard.js';

describe('local-llm-guard', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('probeLocalLlmReachable returns true when /models responds ok', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(probeLocalLlmReachable()).resolves.toBe(true);
  });

  it('probeLocalLlmReachable returns false on connection failure', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    await expect(probeLocalLlmReachable()).resolves.toBe(false);
  });

  it('assertLocalLlmReachable throws when connector is down', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    await expect(assertLocalLlmReachable()).rejects.toThrow(LOCAL_LLM_UNAVAILABLE_MESSAGE);
  });

  it('assertLocalLlmReachable throws when circuit breaker is open', async () => {
    const breaker = {
      getState: () => 'open' as const,
    } as import('../../../../src/shared/infra/llm/circuit-breaker.js').CircuitBreaker;
    await expect(assertLocalLlmReachable(breaker)).rejects.toThrow(/circuit breaker open/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
