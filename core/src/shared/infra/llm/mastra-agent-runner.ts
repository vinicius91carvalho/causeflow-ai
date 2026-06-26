/**
 * Mastra-based AgentRunner — drop-in replacement for EnhancedPTCRunner.
 *
 * Uses Mastra's Agent.generate() with native Langfuse tracing via
 * @mastra/langfuse exporter. All existing tools work via the tool adapter.
 *
 * Cost optimizations:
 * 1. promptCacheMiddleware — injects cache_control breakpoints on system messages
 *    so Anthropic caches the system prompt + tool definitions server-side (~10x cheaper).
 * 2. contextManagement — uses Anthropic's native compaction + clear_tool_uses to
 *    prevent unbounded context growth during multi-step investigations.
 * 3. TokenLimiterProcessor — client-side token limiter as safety net.
 */
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { TokenLimiterProcessor } from '@mastra/core/processors';
import { Observability } from '@mastra/observability';
import { LangfuseExporter } from '@mastra/langfuse';
import { createAnthropic } from '@ai-sdk/anthropic';
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai';
import { adaptToolsForMastra } from './mastra-tool-adapter.js';
import { calculateCost } from '../../domain/cost.js';
import { config as appConfig } from '../../config/index.js';
import { logger } from '../logger.js';
import type { AgentRunner, AgentRunConfig, AgentRunResult } from '../../application/ports/agent-runner.port.js';

// ── Prompt Cache Middleware ──────────────────────────────────────────
// Adds cache_control breakpoints to the last system message and
// the most recent user/assistant message. Runs after Mastra's
// internal message conversions, right before the API call.
// Pattern from: github.com/mastra-ai/mastra/blob/main/mastracode/src/providers/claude-max.ts

const promptCacheMiddleware: LanguageModelMiddleware = {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prompt = [...params.prompt] as any[];
        const cacheControl = { type: 'ephemeral' as const };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addCacheToMessage = (msg: any) => {
            if (typeof msg.content === 'string') {
                return {
                    ...msg,
                    providerOptions: {
                        ...msg.providerOptions,
                        anthropic: { ...msg.providerOptions?.anthropic, cacheControl },
                    },
                };
            }
            if (Array.isArray(msg.content) && msg.content.length > 0) {
                const content = [...msg.content];
                const lastPart = content[content.length - 1];
                content[content.length - 1] = {
                    ...lastPart,
                    providerOptions: {
                        ...lastPart.providerOptions,
                        anthropic: { ...lastPart.providerOptions?.anthropic, cacheControl },
                    },
                };
                return { ...msg, content };
            }
            return msg;
        };

        // Cache the last system message (static instructions + tool definitions)
        let lastSystemIdx = -1;
        for (let i = prompt.length - 1; i >= 0; i--) {
            if (prompt[i].role === 'system') {
                lastSystemIdx = i;
                break;
            }
        }
        if (lastSystemIdx >= 0) {
            prompt[lastSystemIdx] = addCacheToMessage(prompt[lastSystemIdx]);
        }

        // Cache the most recent message (conversation context up to this point)
        const lastIdx = prompt.length - 1;
        if (lastIdx >= 0 && lastIdx !== lastSystemIdx) {
            prompt[lastIdx] = addCacheToMessage(prompt[lastIdx]);
        }

        return { ...params, prompt };
    },
};

// ── Model Factory ────────────────────────────────────────────────────

function buildCachedModel(modelName: string) {
    const anthropic = createAnthropic({ apiKey: appConfig.anthropic.apiKey });
    const baseModel = anthropic(modelName);
    return wrapLanguageModel({
        model: baseModel,
        middleware: promptCacheMiddleware,
    });
}

function resolveModelName(model?: string): string {
    if (!model) return 'claude-sonnet-4-6';
    // Strip anthropic/ prefix if present
    return model.replace(/^anthropic\//, '');
}

// ── Mastra Singleton ────────────────────────────────────────────────

let _mastra: Mastra | null = null;
let _langfuseExporter: LangfuseExporter | null = null;

function getMastra(): Mastra {
    if (_mastra) return _mastra;

    const hasLangfuse = appConfig.langfuse.publicKey && appConfig.langfuse.secretKey;

    if (hasLangfuse) {
        _langfuseExporter = new LangfuseExporter({
            publicKey: appConfig.langfuse.publicKey!,
            secretKey: appConfig.langfuse.secretKey!,
            baseUrl: appConfig.langfuse.baseUrl,
        });
    }

    _mastra = new Mastra({
        ...(hasLangfuse && _langfuseExporter && {
            observability: new Observability({
                configs: {
                    langfuse: {
                        serviceName: 'causeflow-investigation',
                        exporters: [_langfuseExporter],
                    },
                },
            }),
        }),
    });

    return _mastra;
}

// ── Agent Runner ────────────────────────────────────────────────────

export class MastraAgentRunner implements AgentRunner {
    async run(config: AgentRunConfig): Promise<AgentRunResult> {
        const rawModel = resolveModelName(config.model);
        const cachedModel = buildCachedModel(rawModel);
        const mastra = getMastra();

        // Adapt tools with truncation
        const { tools, getToolCalls, getTruncatedCount } = adaptToolsForMastra(
            config.tools,
            config.toolHandler,
            config.onToolCall,
            config.toolCallTracker,
        );

        // Build instructions (static + dynamic combined)
        const instructions = config.staticSystemPrompt
            ? `${config.staticSystemPrompt}\n\n${config.systemPrompt}`
            : config.systemPrompt;

        // Import memory if configured
        let mastraMemory: import('@mastra/memory').Memory | undefined;
        if (config.memory) {
            try {
                const { getMastraMemory } = await import('../memory/mastra-memory-factory.js');
                mastraMemory = getMastraMemory();
            } catch (err) {
                logger.warn({ err }, 'Failed to initialize Mastra Memory — continuing without session persistence');
            }
        }

        // Create agent with:
        // - cachedModel with promptCacheMiddleware for prompt caching
        // - TokenLimiterProcessor as client-side safety net
        // - Anthropic's native contextManagement for server-side compaction
        const agentDef = new Agent({
            id: 'investigation-agent',
            name: 'Investigation Agent',
            instructions,
            model: cachedModel,
            tools,
            inputProcessors: [
                new TokenLimiterProcessor({ limit: 200_000 }),
            ],
            ...(mastraMemory ? { memory: mastraMemory } : {}),
        });

        // Register agent in Mastra so observability hooks are wired
        const mastraWithAgent = new Mastra({
            agents: { 'investigation-agent': agentDef },
            ...(mastra.observability ? { observability: mastra.observability } : {}),
        });
        const agent = mastraWithAgent.getAgent('investigation-agent');

        const maxSteps = config.maxTurns ?? 10;
        let totalToolCalls = 0;
        let turns = 0;

        // Run with minToolCalls enforcement loop
        let messages = config.userPrompt;
        let lastResult: Awaited<ReturnType<typeof agent.generate>> | null = null;

        while (turns < maxSteps) {
            const remainingSteps = maxSteps - turns;

            try {
                const memoryOption = (config.memory && mastraMemory) ? {
                    memory: {
                        thread: config.memory.thread,
                        resource: config.memory.resource,
                    },
                } : {};

                let result: Awaited<ReturnType<typeof agent.generate>>;
                try {
                    // `compact_20260112` is Sonnet/Opus only — Haiku rejects it with a 400.
                    // Follow-up workers run on Haiku, so we only enable the conversation-compaction
                    // strategy when the model family supports it.
                    // `compact_20260112` is Sonnet/Opus only — Haiku rejects it with a 400.
                    // Follow-up workers run on Haiku, so we only enable the conversation-compaction
                    // strategy when the model family supports it.
                    const supportsCompact = !/haiku/i.test(rawModel);
                    const contextManagement = supportsCompact
                        ? {
                            edits: [
                                {
                                    type: 'compact_20260112' as const,
                                    trigger: { type: 'input_tokens' as const, value: 150_000 },
                                    instructions: 'Summarize the investigation so far concisely, preserving all key findings, evidence, hypotheses, and operator corrections.',
                                },
                                {
                                    type: 'clear_tool_uses_20250919' as const,
                                    trigger: { type: 'input_tokens' as const, value: 100_000 },
                                    keep: { type: 'tool_uses' as const, value: 10 },
                                    clearToolInputs: true,
                                },
                            ],
                        }
                        : {
                            edits: [
                                {
                                    type: 'clear_tool_uses_20250919' as const,
                                    trigger: { type: 'input_tokens' as const, value: 100_000 },
                                    keep: { type: 'tool_uses' as const, value: 10 },
                                    clearToolInputs: true,
                                },
                            ],
                        };

                    result = await agent.generate(messages, {
                        maxSteps: remainingSteps,
                        onStepFinish: () => { turns++; },
                        ...memoryOption,
                        providerOptions: {
                            anthropic: { contextManagement },
                        },
                    });
                } catch (memErr) {
                    // If memory init fails, retry without memory
                    if (mastraMemory && String(memErr).includes('not authorized')) {
                        logger.warn({ err: memErr }, 'Mastra Memory failed — retrying without session persistence');
                        mastraMemory = undefined;
                        result = await agent.generate(messages, {
                            maxSteps: remainingSteps,
                            onStepFinish: () => { turns++; },
                        });
                    } else {
                        throw memErr;
                    }
                }

                lastResult = result;
                totalToolCalls = getToolCalls().length;

                // Check minToolCalls enforcement
                if (config.minToolCalls && totalToolCalls < config.minToolCalls && turns < maxSteps) {
                    logger.info({
                        toolCalls: totalToolCalls,
                        minToolCalls: config.minToolCalls,
                        turns,
                    }, 'Agent stopped below minToolCalls, nudging to continue');

                    messages = `You have only used ${totalToolCalls} tool(s) so far. ` +
                        `The minimum for a thorough investigation is ${config.minToolCalls}. ` +
                        `Continue investigating — look deeper into what you've found, ` +
                        `check related services, or verify your hypotheses with additional data.`;
                    continue;
                }

                break;
            } catch (err) {
                logger.error({ err, model: rawModel, turns }, 'Mastra agent generate failed');
                throw err;
            }
        }

        // Flush Langfuse traces before worker exits
        try {
            if (_langfuseExporter) await _langfuseExporter.flush();
        } catch { /* non-critical */ }

        if (!lastResult) {
            throw new Error('Mastra agent produced no result');
        }

        const response = lastResult.text ?? '';
        const inputTokens = lastResult.usage?.inputTokens ?? 0;
        const outputTokens = lastResult.usage?.outputTokens ?? 0;
        const cachedInputTokens = lastResult.usage?.cachedInputTokens ?? 0;
        const cacheCreationInputTokens = (lastResult as Record<string, unknown>).providerMetadata
            ? ((lastResult as Record<string, unknown>).providerMetadata as Record<string, Record<string, number>>)?.anthropic?.cacheCreationInputTokens ?? 0
            : 0;
        const costUsd = calculateCost(rawModel, inputTokens, outputTokens, cachedInputTokens);

        logger.info({
            model: rawModel,
            turns,
            toolCalls: totalToolCalls,
            inputTokens,
            outputTokens,
            cachedInputTokens,
            cacheCreationInputTokens,
            costUsd,
            truncatedResults: getTruncatedCount(),
        }, 'Mastra agent run completed');

        return {
            response,
            toolCalls: getToolCalls(),
            totalUsage: {
                inputTokens,
                outputTokens,
                cacheReadInputTokens: cachedInputTokens || undefined,
                cacheCreationInputTokens: cacheCreationInputTokens || undefined,
            },
            turns,
            model: rawModel,
            costUsd,
            truncatedResults: getTruncatedCount(),
        };
    }
}
