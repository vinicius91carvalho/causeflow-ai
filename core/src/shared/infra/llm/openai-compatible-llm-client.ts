/**
 * OpenAI-compatible LLM client for the OSS local runtime (AC-054).
 * Targets llama.cpp (Ornith 9B) at LLM_BASE_URL — never imports @anthropic-ai/sdk.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { config } from '../../config/index.js';
import type { LLMClient, CompletionParams, CompletionResult } from '../../application/ports/llm-client.port.js';
import { instrumentedCall } from '../observability/outbound.js';

const DEFAULT_TIMEOUT_MS = 120_000;

interface ChatCompletionResponse {
  model: string;
  choices: Array<{
    message: { content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class OpenAiCompatibleLlmClient implements LLMClient {
  private circuitBreaker?: { execute: <T>(fn: () => Promise<T>) => Promise<T> };

  setCircuitBreaker(cb: { execute: <T>(fn: () => Promise<T>) => Promise<T> }): void {
    this.circuitBreaker = cb;
  }

  private call<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker ? this.circuitBreaker.execute(fn) : fn();
  }

  async complete<T>(params: CompletionParams): Promise<CompletionResult<T>> {
    const model = config.llm.model;
    if (params.responseSchema) {
      return this.completeStructured(params, model);
    }
    const response = await instrumentedCall(
      'local-llm',
      'chat.completions',
      () => this.call(() => this.requestCompletion(params, model, false)),
      { attributes: { model, ...(params.attributes ?? {}) } },
    );
    const raw = response.choices[0]?.message?.content ?? '';
    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
    return {
      content: raw as T,
      usage,
      model: response.model,
      costUsd: 0,
    };
  }

  private async completeStructured<T>(params: CompletionParams, model: string): Promise<CompletionResult<T>> {
    const { $schema: _, ...rawSchema } = zodToJsonSchema(params.responseSchema!);
    const schemaHint = JSON.stringify(rawSchema);
    const systemPrompt = `${params.systemPrompt}\n\nRespond with a single JSON object matching this schema (no markdown, no commentary):\n${schemaHint}`;
    const response = await instrumentedCall(
      'local-llm',
      'chat.completions.structured',
      () => this.call(() => this.requestCompletion(
        { ...params, systemPrompt },
        model,
        true,
      )),
      { attributes: { model, ...(params.attributes ?? {}) } },
    );
    const text = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(extractJsonObject(text));
    const validated = params.responseSchema!.parse(parsed);
    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
    return {
      content: validated as T,
      usage,
      model: response.model,
      costUsd: 0,
    };
  }

  private async requestCompletion(
    params: CompletionParams,
    model: string,
    jsonMode: boolean,
  ): Promise<ChatCompletionResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        max_tokens: params.maxTokens,
        temperature: params.temperature ?? 0,
      };
      if (jsonMode) {
        body.response_format = { type: 'json_object' };
      }
      const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.llm.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Local LLM request failed (${res.status}): ${detail.slice(0, 300)}`);
      }
      return await res.json() as ChatCompletionResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Pull the first JSON object from model output (handles thinking tags / prose wrappers). */
export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const end = findMatchingBrace(trimmed);
    if (end > 0) return trimmed.slice(0, end + 1);
  }
  const start = trimmed.indexOf('{');
  const end = start >= 0 ? findMatchingBrace(trimmed.slice(start)) : -1;
  if (start >= 0 && end > 0) {
    return trimmed.slice(start, start + end + 1);
  }
  throw new Error('Local LLM response did not contain a JSON object');
}

function findMatchingBrace(text: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
