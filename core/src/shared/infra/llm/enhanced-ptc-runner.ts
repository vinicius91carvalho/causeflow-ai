/**
 * Enhanced PTC Agent Runner
 *
 * Replaces both AnthropicAgentRunner (toolRunner) and AnthropicPTCAgentRunner (manual loop)
 * with a single robust runner inspired by quacode/Claude Code patterns:
 *
 * - Parallel tool execution: read-only tools run concurrently (up to maxToolConcurrency)
 * - Tool result truncation: large results capped per-tool and per-message aggregate
 * - Retry with exponential backoff: handles 429, 529, and transient API errors
 * - Max output tokens recovery: reduces max_tokens and retries on overflow
 * - Minimum tool calls enforcement: prevents shallow investigations
 * - Prompt caching: static system prompt marked with cache_control
 * - Cascade abort: critical tool failures cancel sibling tools
 * - Code execution support: PTC mode with container reuse
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessageParam,
  BetaContentBlockParam,
  BetaToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages.js';
import { calculateCost } from '../../domain/cost.js';
import { config } from '../../config/index.js';
import type {
  AgentRunner,
  AgentRunConfig,
  AgentRunResult,
  ToolCallRecord,
  ToolDefinition,
} from '../../application/ports/agent-runner.port.js';

// --- Constants ---

const DEFAULT_MAX_RESULT_CHARS = 50_000;
const DEFAULT_MAX_TOOL_CONCURRENCY = 10;
const DEFAULT_MAX_RETRIES = 5;
const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3;
const PER_MESSAGE_BUDGET_CHARS = 200_000;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 32_000;
const RETRYABLE_STATUS_CODES = new Set([429, 529, 408, 409, 500, 502, 503]);
const CRITICAL_FAILURE_CODES = new Set([401, 403]);

// --- Types ---

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface Batch {
  safe: boolean;
  calls: ToolCall[];
}

// --- Utility Functions ---

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Aborted'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      },
      { once: true },
    );
  });
}

/**
 * Truncate a tool result if it exceeds maxChars.
 * Appends a truncation notice so the model knows the output was cut.
 */
function truncateResult(result: string, maxChars: number): { text: string; wasTruncated: boolean } {
  if (result.length <= maxChars) return { text: result, wasTruncated: false };
  return {
    text:
      result.slice(0, maxChars) +
      `\n\n[TRUNCATED: showing first ${maxChars.toLocaleString()} of ${result.length.toLocaleString()} chars. Focus on what's shown above.]`,
    wasTruncated: true,
  };
}

/**
 * Enforce per-message aggregate budget on tool results.
 * If total chars exceed budget, truncate the largest results first.
 */
function enforceMessageBudget(
  results: { toolUseId: string; content: string }[],
  budgetChars: number,
): { toolUseId: string; content: string }[] {
  const totalChars = results.reduce((sum, r) => sum + r.content.length, 0);
  if (totalChars <= budgetChars) return results;

  // Sort by size descending, truncate largest first
  const sorted = [...results].sort((a, b) => b.content.length - a.content.length);
  let remaining = totalChars;
  const truncationMap = new Map<string, string>();

  for (const r of sorted) {
    if (remaining <= budgetChars) break;
    const excess = remaining - budgetChars;
    const newLen = Math.max(1000, r.content.length - excess); // keep at least 1000 chars
    truncationMap.set(
      r.toolUseId,
      r.content.slice(0, newLen) +
        `\n\n[BUDGET TRUNCATED: reduced from ${r.content.length.toLocaleString()} to ${newLen.toLocaleString()} chars to fit message budget]`,
    );
    remaining -= r.content.length - newLen;
  }

  return results.map((r) => ({
    toolUseId: r.toolUseId,
    content: truncationMap.get(r.toolUseId) ?? r.content,
  }));
}

/**
 * Partition tool calls into batches based on concurrency safety.
 * Consecutive safe tools are grouped into a single parallel batch.
 * Inspired by quacode's partitionToolCalls in toolOrchestration.ts.
 */
function partitionToolCalls(calls: ToolCall[], toolDefs: ToolDefinition[]): Batch[] {
  const defMap = new Map(toolDefs.map((t) => [t.name, t]));
  return calls.reduce<Batch[]>((batches, call) => {
    const def = defMap.get(call.name);
    const safe = def?.isConcurrencySafe ?? true; // default safe for causeflow (all read-only)
    const lastBatch = batches.at(-1);
    if (safe && lastBatch?.safe) {
      lastBatch.calls.push(call);
    } else {
      batches.push({ safe, calls: [call] });
    }
    return batches;
  }, []);
}

/**
 * Retry wrapper with exponential backoff and jitter.
 * Inspired by quacode's withRetry in src/services/api/withRetry.ts.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  opts: { maxRetries: number; signal?: AbortSignal },
): Promise<{ result: T; retries: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    if (opts.signal?.aborted) throw new Error('Aborted');
    try {
      const result = await operation();
      return { result, retries: attempt - 1 };
    } catch (error) {
      lastError = error;
      if (attempt > opts.maxRetries) break;
      if (!isRetryable(error)) break;
      const delay = getRetryDelay(attempt);
      await sleep(delay, opts.signal);
    }
  }
  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }
  // Retry on network errors
  if (error instanceof Error && 'code' in error) {
    const code = (error as any).code;
    return code === 'ECONNRESET' || code === 'EPIPE' || code === 'ETIMEDOUT';
  }
  return false;
}

function getRetryDelay(attempt: number): number {
  const baseDelay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), RETRY_MAX_DELAY_MS);
  const jitter = baseDelay * 0.25 * Math.random();
  return baseDelay + jitter;
}

function isCriticalToolFailure(err: unknown): boolean {
  if (err instanceof Error && 'status' in err) {
    return CRITICAL_FAILURE_CODES.has((err as any).status);
  }
  if (err instanceof Error && err.message) {
    return (
      /credentials?\s*(expired|invalid)/i.test(err.message) || /unauthorized/i.test(err.message)
    );
  }
  return false;
}

// --- Enhanced PTC Runner ---

export class EnhancedPTCRunner implements AgentRunner {
  private client: Anthropic | null;

  constructor() {
    // AC-046: refuse to construct the SDK client without a key so OSS
    // zero-SaaS never emits "Could not resolve authentication method".
    if (!config.anthropic.apiKey) {
      this.client = null;
    } else {
      this.client = new Anthropic({
        apiKey: config.anthropic.apiKey,
        ...(config.anthropic.baseUrl && { baseURL: config.anthropic.baseUrl }),
      });
    }
  }

  async run(agentConfig: AgentRunConfig): Promise<AgentRunResult> {
    if (!this.client || !config.anthropic.apiKey) {
      throw new Error(
        'EnhancedPTCRunner requires ANTHROPIC_API_KEY; use StubAgentRunner in OSS zero-SaaS mode',
      );
    }
    const client = this.client;
    const model = agentConfig.model ?? config.anthropic.investigationModel;
    const maxTurns = agentConfig.maxTurns ?? 10;
    let maxTokens = agentConfig.maxTokens ?? 4096;
    const temperature = agentConfig.temperature ?? 0;
    const maxConcurrency = agentConfig.maxToolConcurrency ?? DEFAULT_MAX_TOOL_CONCURRENCY;
    const maxRetries = agentConfig.maxRetries ?? DEFAULT_MAX_RETRIES;
    const minToolCalls = agentConfig.minToolCalls;

    const allToolCalls: ToolCallRecord[] = [];
    const allTextBlocks: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let cacheReadInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let turns = 0;
    let totalToolCalls = 0;
    let truncatedResults = 0;
    let parallelBatches = 0;
    let totalRetries = 0;
    let maxTokensRecoveryCount = 0;
    let containerId = agentConfig.containerId;
    let lastModel = model;

    // Build tools array
    const tools: Record<string, unknown>[] = agentConfig.tools.map((t) => ({
      type: 'custom',
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    if (agentConfig.useCodeExecution) {
      tools.push({ type: 'code_execution_20250522', name: 'code_execution' });
    }

    // Build system prompt with optional prompt caching
    const systemPrompt = this.buildSystemPrompt(agentConfig);

    // Initial messages
    const messages: BetaMessageParam[] = [
      { role: 'user' as const, content: agentConfig.userPrompt },
    ];

    // --- Main Loop ---
    while (turns < maxTurns) {
      if (agentConfig.signal?.aborted) break;
      turns++;

      // API call with retry
      let response: any;
      try {
        const { result, retries } = await withRetry(
          () =>
            client.beta.messages.create({
              model,
              max_tokens: maxTokens,
              temperature,
              system: systemPrompt as any,
              messages,
              tools: tools as any,
              ...(containerId ? { container: containerId } : {}),
            } as any),
          { maxRetries, signal: agentConfig.signal },
        );
        response = result;
        totalRetries += retries;
      } catch (error) {
        // If all retries exhausted, propagate
        throw error;
      }

      // Track usage
      if (response.usage) {
        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;
        if (response.usage.cache_read_input_tokens) {
          cacheReadInputTokens += response.usage.cache_read_input_tokens;
        }
        if (response.usage.cache_creation_input_tokens) {
          cacheCreationInputTokens += response.usage.cache_creation_input_tokens;
        }
      }
      lastModel = response.model ?? model;

      // Track container ID for PTC reuse
      if (response.container?.id) {
        containerId = response.container.id;
      }

      // Collect text and tool_use blocks
      const toolUseBlocks: ToolCall[] = [];
      for (const block of response.content) {
        if (block.type === 'text') {
          allTextBlocks.push(block.text);
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      // Handle stop reasons
      if (response.stop_reason === 'pause_turn') {
        messages.push({
          role: 'assistant' as const,
          content: response.content as unknown as BetaContentBlockParam[],
        });
        continue;
      }

      if (response.stop_reason === 'max_tokens') {
        // Max output tokens recovery: reduce and retry (up to 3x)
        if (maxTokensRecoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
          maxTokensRecoveryCount++;
          maxTokens = Math.max(1024, Math.floor(maxTokens * 0.75));
          turns--; // don't count this as a turn
          continue;
        }
        break;
      }

      if (response.stop_reason !== 'tool_use') {
        // Check minToolCalls enforcement before accepting end_turn
        if (minToolCalls && totalToolCalls < minToolCalls) {
          messages.push({
            role: 'assistant' as const,
            content: response.content as unknown as BetaContentBlockParam[],
          });
          messages.push({
            role: 'user' as const,
            content:
              `You have only used ${totalToolCalls} tool${totalToolCalls === 1 ? '' : 's'} so far. ` +
              `The minimum for a thorough investigation is ${minToolCalls}. ` +
              `Continue investigating — check additional sources, time ranges, or correlate with other data.`,
          });
          continue;
        }
        break;
      }

      // --- Execute tool calls ---
      if (toolUseBlocks.length > 0) {
        messages.push({
          role: 'assistant' as const,
          content: response.content as unknown as BetaContentBlockParam[],
        });

        const batches = partitionToolCalls(toolUseBlocks, agentConfig.tools);
        const allResults: { toolUseId: string; content: string; isError: boolean }[] = [];

        for (const batch of batches) {
          if (agentConfig.signal?.aborted) break;

          let batchResults: { toolUseId: string; content: string; isError: boolean }[];

          if (batch.safe && batch.calls.length > 1) {
            // Parallel execution with cascade abort
            parallelBatches++;
            batchResults = await this.executeBatchParallel(
              batch.calls,
              agentConfig.toolHandler,
              maxConcurrency,
              agentConfig.signal,
            );
          } else {
            // Serial execution
            batchResults = await this.executeBatchSerial(
              batch.calls,
              agentConfig.toolHandler,
              agentConfig.signal,
            );
          }

          // Truncate per-tool results
          for (const r of batchResults) {
            const def = agentConfig.tools.find(
              (t) => t.name === toolUseBlocks.find((tb) => tb.id === r.toolUseId)?.name,
            );
            const maxChars = def?.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;
            const { text, wasTruncated } = truncateResult(r.content, maxChars);
            r.content = text;
            if (wasTruncated) truncatedResults++;
          }

          allResults.push(...batchResults);
        }

        // Enforce per-message aggregate budget
        const budgeted = enforceMessageBudget(
          allResults.map((r) => ({ toolUseId: r.toolUseId, content: r.content })),
          PER_MESSAGE_BUDGET_CHARS,
        );

        // Record tool calls and build tool_results message
        const toolResultBlocks: BetaToolResultBlockParam[] = allResults.map((r) => {
          const call = toolUseBlocks.find((tb) => tb.id === r.toolUseId)!;
          const budgetedContent =
            budgeted.find((b) => b.toolUseId === r.toolUseId)?.content ?? r.content;
          allToolCalls.push({ name: call.name, input: call.input, output: budgetedContent });
          totalToolCalls++;
          return {
            type: 'tool_result' as const,
            tool_use_id: r.toolUseId,
            content: budgetedContent,
            is_error: r.isError,
          };
        });

        messages.push({ role: 'user' as const, content: toolResultBlocks });
      }
    }

    return {
      response: allTextBlocks.join('\n\n') || '',
      toolCalls: allToolCalls,
      totalUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheReadInputTokens: cacheReadInputTokens || undefined,
        cacheCreationInputTokens: cacheCreationInputTokens || undefined,
      },
      turns,
      model: lastModel,
      costUsd: calculateCost(model, totalInputTokens, totalOutputTokens, cacheReadInputTokens),
      truncatedResults: truncatedResults || undefined,
      parallelBatches: parallelBatches || undefined,
      retryCount: totalRetries || undefined,
    };
  }

  /**
   * Build system prompt with optional prompt caching.
   * If staticSystemPrompt is provided, it gets cache_control marker.
   */
  private buildSystemPrompt(agentConfig: AgentRunConfig): string | object[] {
    if (agentConfig.staticSystemPrompt) {
      const blocks: object[] = [
        {
          type: 'text',
          text: agentConfig.staticSystemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ];
      if (agentConfig.systemPrompt) {
        blocks.push({ type: 'text', text: agentConfig.systemPrompt });
      }
      return blocks;
    }
    return agentConfig.systemPrompt;
  }

  /**
   * Execute a batch of tools in parallel with concurrency limit and cascade abort.
   */
  private async executeBatchParallel(
    calls: ToolCall[],
    handler: (name: string, input: Record<string, unknown>) => Promise<string>,
    maxConcurrency: number,
    signal?: AbortSignal,
  ): Promise<{ toolUseId: string; content: string; isError: boolean }[]> {
    const batchAbort = new AbortController();
    signal?.addEventListener('abort', () => batchAbort.abort(), { once: true });

    const results: { toolUseId: string; content: string; isError: boolean }[] = [];
    const pending: Promise<void>[] = [];
    let activeCount = 0;

    const resolvers: (() => void)[] = [];
    function waitForSlot(): Promise<void> {
      if (activeCount < maxConcurrency) return Promise.resolve();
      return new Promise<void>((resolve) => resolvers.push(resolve));
    }
    function releaseSlot(): void {
      activeCount--;
      const next = resolvers.shift();
      if (next) next();
    }

    for (const call of calls) {
      await waitForSlot();
      if (batchAbort.signal.aborted) {
        results.push({
          toolUseId: call.id,
          content: 'Aborted: sibling tool failed critically',
          isError: true,
        });
        continue;
      }

      activeCount++;
      const p = (async () => {
        try {
          const output = await handler(call.name, call.input);
          results.push({ toolUseId: call.id, content: output, isError: false });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ toolUseId: call.id, content: message, isError: true });
          if (isCriticalToolFailure(err)) {
            batchAbort.abort();
          }
        } finally {
          releaseSlot();
        }
      })();
      pending.push(p);
    }

    await Promise.all(pending);

    // Sort results back to original order
    const orderMap = new Map(calls.map((c, i) => [c.id, i]));
    results.sort((a, b) => (orderMap.get(a.toolUseId) ?? 0) - (orderMap.get(b.toolUseId) ?? 0));

    return results;
  }

  /**
   * Execute a batch of tools serially.
   */
  private async executeBatchSerial(
    calls: ToolCall[],
    handler: (name: string, input: Record<string, unknown>) => Promise<string>,
    signal?: AbortSignal,
  ): Promise<{ toolUseId: string; content: string; isError: boolean }[]> {
    const results: { toolUseId: string; content: string; isError: boolean }[] = [];
    for (const call of calls) {
      if (signal?.aborted) {
        results.push({ toolUseId: call.id, content: 'Aborted', isError: true });
        continue;
      }
      try {
        const output = await handler(call.name, call.input);
        results.push({ toolUseId: call.id, content: output, isError: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ toolUseId: call.id, content: message, isError: true });
      }
    }
    return results;
  }
}
