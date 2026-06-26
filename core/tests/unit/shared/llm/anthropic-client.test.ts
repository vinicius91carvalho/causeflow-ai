import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  }));
  return { default: MockAnthropic };
});

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    anthropic: {
      apiKey: 'test-key',
      baseUrl: undefined,
      triageModel: 'claude-sonnet-4-5-20250929',
      investigationModel: 'claude-sonnet-4-5-20250929',
    },
    logLevel: 'info',
    isDev: () => false,
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { logger, rootLogger: logger };
});

import { AnthropicClient } from '../../../../src/shared/infra/llm/anthropic-client.js';
import Anthropic from '@anthropic-ai/sdk';

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AnthropicClient();
    const instance = vi.mocked(Anthropic).mock.results[0]?.value as { messages: { create: ReturnType<typeof vi.fn> } };
    mockCreate = instance.messages.create;
  });

  it('should return raw text content without schema', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello world' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-4-5-20250929',
    });

    const result = await client.complete<string>({
      systemPrompt: 'You are helpful.',
      userPrompt: 'Say hello',
      maxTokens: 100,
    });

    expect(result.content).toBe('Hello world');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.model).toBe('claude-sonnet-4-5-20250929');
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('should parse structured output via output_config json_schema', async () => {
    const schema = z.object({
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      summary: z.string(),
    });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ priority: 'high', summary: 'CPU spike detected' }),
        },
      ],
      usage: { input_tokens: 50, output_tokens: 20 },
      model: 'claude-sonnet-4-5-20250929',
    });

    const result = await client.complete({
      systemPrompt: 'Classify the incident.',
      userPrompt: 'CPU at 95%',
      maxTokens: 256,
      responseSchema: schema,
    });

    expect(result.content).toEqual({ priority: 'high', summary: 'CPU spike detected' });
    expect(result.costUsd).toBeGreaterThan(0);

    // Verify output_config was used
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        output_config: {
          format: expect.objectContaining({ type: 'json_schema' }),
        },
      }),
    );
  });

  it('should throw when response has no text block for structured output', async () => {
    const schema = z.object({ priority: z.string() });

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'toolu_01', name: 'unexpected', input: {} }],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-4-5-20250929',
    });

    await expect(
      client.complete({
        systemPrompt: 'Analyze.',
        userPrompt: 'Test',
        maxTokens: 100,
        responseSchema: schema,
      }),
    ).rejects.toThrow('Expected text block for structured output');
  });

  it('should validate parsed JSON against Zod schema', async () => {
    const schema = z.object({
      priority: z.enum(['critical', 'high', 'medium', 'low']),
    });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ priority: 'invalid_value' }),
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-4-5-20250929',
    });

    await expect(
      client.complete({
        systemPrompt: 'Analyze.',
        userPrompt: 'Test',
        maxTokens: 100,
        responseSchema: schema,
      }),
    ).rejects.toThrow();
  });

  it('should propagate API errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    await expect(
      client.complete({
        systemPrompt: 'Test.',
        userPrompt: 'Test',
        maxTokens: 100,
      }),
    ).rejects.toThrow('API rate limit exceeded');
  });
});
