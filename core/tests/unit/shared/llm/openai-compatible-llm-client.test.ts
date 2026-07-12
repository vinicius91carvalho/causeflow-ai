import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  extractJsonObject,
  OpenAiCompatibleLlmClient,
} from '../../../../src/shared/infra/llm/openai-compatible-llm-client.js';

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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
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
});
