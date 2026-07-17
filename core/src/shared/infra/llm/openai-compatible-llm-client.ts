/**
 * OpenAI-compatible LLM client for the OSS local runtime (AC-054).
 * Targets llama.cpp (Ornith 9B) at LLM_BASE_URL — never imports @anthropic-ai/sdk.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  LLMClient,
  CompletionParams,
  CompletionResult,
} from '../../application/ports/llm-client.port.js';
import { instrumentedCall } from '../observability/outbound.js';
import {
  InvestigationLlmChainExhaustedError,
  resolveActiveLlmEndpointChain,
  type ResolvedLlmEndpoint,
} from './llm-connector-profile.js';
import {
  LlmContextTooLargeError,
  contextOverflowGuidance,
  isContextOverflowError,
} from './llm-context-errors.js';
import {
  endpointCircuitBreakerKey,
  getOssLlmCircuitBreakerForEndpoint,
} from './oss-llm-circuit-breaker.js';

const DEFAULT_TIMEOUT_MS = Number(process.env['LLM_TIMEOUT_MS'] ?? 300_000);

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
  /** When set, each chain hop uses a per-endpoint breaker (AC-018). */
  private circuitBreakerEnabled = false;

  setCircuitBreaker(_cb: { execute: <T>(fn: () => Promise<T>) => Promise<T> }): void {
    this.circuitBreakerEnabled = true;
  }

  /**
   * AC-018: execute under a per-endpoint (profileId/baseUrl) circuit breaker so a
   * failed active hop cannot CircuitBreakerOpenError healthy fallbackProfileId hops.
   */
  private callForEndpoint<T>(endpoint: ResolvedLlmEndpoint, fn: () => Promise<T>): Promise<T> {
    if (!this.circuitBreakerEnabled) return fn();
    const key = endpointCircuitBreakerKey(endpoint);
    return getOssLlmCircuitBreakerForEndpoint(key).execute(fn);
  }

  async complete<T>(params: CompletionParams): Promise<CompletionResult<T>> {
    const tenantId =
      typeof params.attributes?.tenantId === 'string' ? params.attributes.tenantId : undefined;
    // AC-018: try active profile then optional fallbackProfileId chain (cycle-safe / max depth).
    // Fail closed — never silently succeed via DeterministicLLMClient or Anthropic.
    const chain = await resolveActiveLlmEndpointChain(tenantId);
    let lastError: unknown;
    for (const endpoint of chain) {
      try {
        if (params.responseSchema) {
          return await this.completeStructured(params, endpoint);
        }
        return await this.completePlain(params, endpoint);
      } catch (err) {
        lastError = err;
      }
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown');
    throw new InvestigationLlmChainExhaustedError(
      `Investigation LLM failed and the fallbackProfileId chain is missing or exhausted (${detail}). Configure or fix the Investigation LLM in Settings — Core does not silently succeed via DeterministicLLMClient or Anthropic.`,
    );
  }

  private async completePlain<T>(
    params: CompletionParams,
    endpoint: ResolvedLlmEndpoint,
  ): Promise<CompletionResult<T>> {
    const model = endpoint.model;
    const response = await instrumentedCall(
      'local-llm',
      'chat.completions',
      () => this.callForEndpoint(endpoint, () => this.requestCompletion(params, endpoint, false)),
      { attributes: { model, connector: endpoint.connectorId, ...(params.attributes ?? {}) } },
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

  private async completeStructured<T>(
    params: CompletionParams,
    endpoint: ResolvedLlmEndpoint,
  ): Promise<CompletionResult<T>> {
    const model = endpoint.model;
    const { $schema: _, ...rawSchema } = zodToJsonSchema(params.responseSchema!);
    const schemaHint = JSON.stringify(rawSchema);
    const systemPrompt = `${params.systemPrompt}\n\nRespond with a single JSON object matching this schema (no markdown, no commentary):\n${schemaHint}`;

    const attempt = async (userPrompt: string): Promise<CompletionResult<T>> => {
      const response = await instrumentedCall(
        'local-llm',
        'chat.completions.structured',
        () =>
          this.callForEndpoint(endpoint, () =>
            this.requestCompletion({ ...params, systemPrompt, userPrompt }, endpoint, true),
          ),
        { attributes: { model, connector: endpoint.connectorId, ...(params.attributes ?? {}) } },
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
    };

    try {
      return await attempt(params.userPrompt);
    } catch (err) {
      // Ornith/local models often omit required keys on the first pass — one
      // repair retry with the broken JSON keeps the OSS golden path alive.
      const broken = err instanceof Error ? err.message.slice(0, 800) : String(err);
      const repairPrompt =
        `${params.userPrompt}\n\nYour previous JSON failed schema validation:\n${broken}\n` +
        `Return a corrected single JSON object that satisfies the schema exactly.`;
      return attempt(repairPrompt);
    }
  }

  private async requestCompletion(
    params: CompletionParams,
    endpoint: ResolvedLlmEndpoint,
    jsonMode: boolean,
  ): Promise<ChatCompletionResponse> {
    const { baseUrl, model, apiKey, connectorId } = endpoint;
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
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        const snippet = detail.slice(0, 500);
        if (isContextOverflowError(snippet, res.status)) {
          throw new LlmContextTooLargeError(
            `${contextOverflowGuidance(connectorId)} (${snippet.slice(0, 200)})`,
            connectorId,
            model,
            res.status,
          );
        }
        throw new Error(`Local LLM request failed (${res.status}): ${snippet.slice(0, 300)}`);
      }
      return (await res.json()) as ChatCompletionResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Pull the first JSON object from model output (handles thinking tags / prose wrappers). */
export function extractJsonObject(text: string): string {
  const stripped = stripLlmWrappers(text);
  const trimmed = stripped.trim();
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

/** Remove Ornith/llama thinking blocks and markdown JSON fences before parsing. */
function stripLlmWrappers(text: string): string {
  let out = text;
  out = out.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '');
  out = out.replace(/[\s\S]*?<\/think>/gi, '');
  const fenced = out.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }
  return out;
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
