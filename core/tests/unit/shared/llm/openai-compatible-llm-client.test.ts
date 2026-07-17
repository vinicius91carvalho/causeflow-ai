import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  extractJsonObject,
  OpenAiCompatibleLlmClient,
} from '../../../../src/shared/infra/llm/openai-compatible-llm-client.js';
import { CircuitBreaker } from '../../../../src/shared/infra/llm/circuit-breaker.js';
import {
  clearOssLlmCircuitBreakersForTests,
  registerOssLlmCircuitBreaker,
} from '../../../../src/shared/infra/llm/oss-llm-circuit-breaker.js';
import { InvestigationLlmChainExhaustedError } from '../../../../src/shared/infra/llm/llm-connector-profile.js';

const resolveActiveLlmEndpointChain = vi.fn();

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

vi.mock('../../../../src/shared/infra/observability/outbound.js', () => ({
  instrumentedCall: async (_svc: string, _op: string, fn: () => Promise<unknown>) => fn(),
}));

vi.mock('../../../../src/shared/infra/llm/llm-connector-profile.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../src/shared/infra/llm/llm-connector-profile.js')>();
  return {
    ...actual,
    resolveActiveLlmEndpointChain: (...args: unknown[]) => resolveActiveLlmEndpointChain(...args),
  };
});

describe('extractJsonObject', () => {
  it('extracts a JSON object wrapped in prose', () => {
    const raw = 'Here is the result: {"priority":"high","summary":"cpu"} end';
    expect(JSON.parse(extractJsonObject(raw))).toEqual({ priority: 'high', summary: 'cpu' });
  });

  it('extracts JSON from Ornith thinking tags and markdown fences', () => {
    const raw = `<think>reasoning</think>

\`\`\`json
{
  "priority": "high",
  "summary": "cpu spike",
  "suggestedAgents": ["log_analyst"],
  "confidence": 0.9,
  "category": "application",
  "investigationMode": "orchestrator"
}
\`\`\``;
    expect(JSON.parse(extractJsonObject(raw))).toMatchObject({
      priority: 'high',
      suggestedAgents: ['log_analyst'],
    });
  });
});

describe('OpenAiCompatibleLlmClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    clearOssLlmCircuitBreakersForTests();
    resolveActiveLlmEndpointChain.mockReset();
    resolveActiveLlmEndpointChain.mockResolvedValue([
      {
        connectorId: 'ornith',
        baseUrl: 'http://127.0.0.1:8081/v1',
        model: 'Ornith-1.0-9B-code',
        apiKey: 'local',
        contextWindowTokens: 32768,
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    clearOssLlmCircuitBreakersForTests();
  });

  it('calls the configured base URL and model', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'Ornith-1.0-9B-code',
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const client = new OpenAiCompatibleLlmClient();
    const result = await client.complete({
      systemPrompt: 'sys',
      userPrompt: 'user',
      maxTokens: 32,
    });

    expect(result.content).toBe('hello');
    expect(result.model).toBe('Ornith-1.0-9B-code');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8081/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('Ornith-1.0-9B-code');
  });

  it('parses structured JSON responses', async () => {
    const schema = z.object({ priority: z.string() });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'Ornith-1.0-9B-code',
        choices: [{ message: { content: '{"priority":"high"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const client = new OpenAiCompatibleLlmClient();
    const result = await client.complete({
      systemPrompt: 'sys',
      userPrompt: 'user',
      maxTokens: 32,
      responseSchema: schema,
    });

    expect(result.content).toEqual({ priority: 'high' });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('AC-018: failed active hop does not CircuitBreakerOpenError healthy fallbackProfileId', async () => {
    registerOssLlmCircuitBreaker(new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 }));
    resolveActiveLlmEndpointChain.mockResolvedValue([
      {
        connectorId: 'bad',
        profileId: 'bad-active',
        baseUrl: 'http://bad.invalid:9/v1',
        model: 'bad-model',
        apiKey: 'local',
        contextWindowTokens: 32768,
      },
      {
        connectorId: 'ornith',
        profileId: 'good-fallback',
        baseUrl: 'http://host.docker.internal:8081/v1',
        model: 'Ornith-1.0-9B-code',
        apiKey: 'local',
        contextWindowTokens: 32768,
      },
    ]);

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('bad.invalid')) {
        throw new Error('fetch failed');
      }
      return {
        ok: true,
        json: async () => ({
          model: 'Ornith-1.0-9B-code',
          choices: [{ message: { content: 'from-fallback' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      };
    });

    const client = new OpenAiCompatibleLlmClient();
    client.setCircuitBreaker(new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 }));

    const result = await client.complete({
      systemPrompt: 'sys',
      userPrompt: 'user',
      maxTokens: 32,
      attributes: { tenantId: 'tenant-1' },
    });

    expect(result.content).toBe('from-fallback');
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('bad.invalid'))).toBe(true);
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('host.docker.internal:8081')),
    ).toBe(true);
  });

  it('AC-018: exhausted chain fails closed with configure/fix-LLM error', async () => {
    registerOssLlmCircuitBreaker(new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 }));
    resolveActiveLlmEndpointChain.mockResolvedValue([
      {
        connectorId: 'bad-a',
        profileId: 'a',
        baseUrl: 'http://bad-a.invalid:9/v1',
        model: 'm',
        apiKey: 'local',
        contextWindowTokens: 32768,
      },
      {
        connectorId: 'bad-b',
        profileId: 'b',
        baseUrl: 'http://bad-b.invalid:9/v1',
        model: 'm',
        apiKey: 'local',
        contextWindowTokens: 32768,
      },
    ]);
    fetchMock.mockRejectedValue(new Error('connection refused'));

    const client = new OpenAiCompatibleLlmClient();
    client.setCircuitBreaker(new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 }));

    await expect(
      client.complete({
        systemPrompt: 'sys',
        userPrompt: 'user',
        maxTokens: 32,
        attributes: { tenantId: 'tenant-1' },
      }),
    ).rejects.toBeInstanceOf(InvestigationLlmChainExhaustedError);

    await expect(
      client.complete({
        systemPrompt: 'sys',
        userPrompt: 'user',
        maxTokens: 32,
        attributes: { tenantId: 'tenant-1' },
      }),
    ).rejects.toThrow(/Configure or fix the Investigation LLM/);
  });
});
