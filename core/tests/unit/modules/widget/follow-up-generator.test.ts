import { describe, it, expect, vi } from 'vitest';
import { FollowUpGenerator } from '../../../../src/modules/widget/application/follow-up-generator.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockLLM(response: string): LLMClient {
  return {
    complete: vi.fn(async () => ({
      content: response,
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'claude-haiku-4-5-20251001',
      costUsd: 0.001,
    })) as any,
  };
}

describe('FollowUpGenerator', () => {
  it('should return follow-up questions when context is missing', async () => {
    const llm = createMockLLM(JSON.stringify({
      needsFollowUp: true,
      questions: ['Qual serviço está com problema?', 'Quando começou?'],
      reasoning: 'No service specified',
    }));
    const generator = new FollowUpGenerator(llm);

    const result = await generator.generate('tá bugado', []);
    expect(result).toEqual(['Qual serviço está com problema?', 'Quando começou?']);
  });

  it('should return null when message has enough context', async () => {
    const llm = createMockLLM(JSON.stringify({
      needsFollowUp: false,
      questions: [],
      reasoning: 'Service and issue are clear',
    }));
    const generator = new FollowUpGenerator(llm);

    const result = await generator.generate('Payment service retornou 500 para clientes', []);
    expect(result).toBeNull();
  });

  it('should include conversation history in the prompt', async () => {
    const llm = createMockLLM(JSON.stringify({ needsFollowUp: false, questions: [] }));
    const generator = new FollowUpGenerator(llm);

    await generator.generate('e agora?', [
      { role: 'user', content: 'OTP não chegou', timestamp: '2024-01-01T00:00:00Z' },
      { role: 'assistant', content: 'Qual cliente?', timestamp: '2024-01-01T00:00:01Z' },
    ]);

    expect(llm.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining('OTP não chegou'),
      }),
    );
  });

  it('should handle LLM errors gracefully', async () => {
    const llm: LLMClient = {
      complete: vi.fn(async () => { throw new Error('API down'); }) as any,
    };
    const generator = new FollowUpGenerator(llm);

    const result = await generator.generate('test message', []);
    expect(result).toBeNull();
  });

  it('should handle malformed LLM response gracefully', async () => {
    const llm = createMockLLM('not a json response');
    const generator = new FollowUpGenerator(llm);

    const result = await generator.generate('test', []);
    expect(result).toBeNull();
  });
});
