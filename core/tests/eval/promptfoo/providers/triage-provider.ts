/* eslint-disable */
import type { ApiProvider, ProviderOptions, ProviderResponse, CallApiContextParams } from 'promptfoo';
import { AnthropicClient } from '../../../../src/shared/infra/llm/anthropic-client.js';
import { triageResultSchema, TRIAGE_SYSTEM_PROMPT } from '../../../../src/modules/triage/domain/triage.prompts.js';

export default class TriageProvider implements ApiProvider {
  private readonly client: AnthropicClient;
  private readonly model: string;
  private readonly providerId: string;

  constructor(options: ProviderOptions) {
    this.providerId = options.id ?? 'causeflow:triage';
    this.model = (options.config as Record<string, string>)?.model ?? 'claude-haiku-4-5-20251001';
    this.client = new AnthropicClient();
  }

  id(): string {
    return `${this.providerId}:${this.model}`;
  }

  async callApi(prompt: string, _context?: CallApiContextParams): Promise<ProviderResponse> {
    const start = Date.now();

    try {
      const result = await this.client.complete({
        model: this.model,
        systemPrompt: TRIAGE_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: 512,
        temperature: 0,
        responseSchema: triageResultSchema,
      });

      const latencyMs = Date.now() - start;

      return {
        output: JSON.stringify(result.content),
        tokenUsage: {
          total: result.usage.inputTokens + result.usage.outputTokens,
          prompt: result.usage.inputTokens,
          completion: result.usage.outputTokens,
        },
        cost: result.costUsd,
        metadata: { latencyMs, model: result.model },
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
