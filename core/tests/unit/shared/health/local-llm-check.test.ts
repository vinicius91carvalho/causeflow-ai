import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    isOss: () => true,
    isDev: () => false,
    isTest: () => true,
    logLevel: 'silent',
    anthropic: { apiKey: '' },
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

import { config } from '../../../../src/shared/config/index.js';
import { LocalLlmHealthCheck } from '../../../../src/shared/infra/health/checks/local-llm-check.js';

describe('LocalLlmHealthCheck', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    config.anthropic.apiKey = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('reports ok when the local connector responds', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const check = new LocalLlmHealthCheck();
    const result = await check.check();
    expect(result.status).toBe('ok');
    expect(result.name).toBe('llm');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8081/v1/models',
      expect.any(Object),
    );
  });

  it('reports degraded when the connector is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    const check = new LocalLlmHealthCheck();
    const result = await check.check();
    expect(result.status).toBe('degraded');
  });

  it('skips when Anthropic override is configured', async () => {
    config.anthropic.apiKey = 'sk-test';
    const check = new LocalLlmHealthCheck();
    const result = await check.check();
    expect(result.status).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
