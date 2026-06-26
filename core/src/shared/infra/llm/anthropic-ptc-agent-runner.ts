/**
 * Anthropic PTC (Programmatic Tool Calling) Agent Runner
 *
 * Uses manual message loop with code_execution server tool instead of
 * client.beta.messages.toolRunner(). This enables:
 *  - Code execution: Claude writes code that calls our tools in a loop
 *  - Container reuse across turns (via container ID tracking)
 *  - Handling both client-side and server-side tool blocks
 *
 * The legacy AnthropicAgentRunner remains as fallback (feature flag).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam, BetaContentBlockParam, BetaToolResultBlockParam } from '@anthropic-ai/sdk/resources/beta/messages.js';
import { calculateCost } from '../../domain/cost.js';
import { config } from '../../config/index.js';
import type { AgentRunner, AgentRunConfig, AgentRunResult, ToolCallRecord } from '../../application/ports/agent-runner.port.js';

export interface PTCAgentRunConfig extends AgentRunConfig {
    useCodeExecution?: boolean;
    containerId?: string;
}

export class AnthropicPTCAgentRunner {
    client;
    constructor() {
        this.client = new Anthropic({
            apiKey: config.anthropic.apiKey,
            ...(config.anthropic.baseUrl && { baseURL: config.anthropic.baseUrl }),
        });
    }
    async run(agentConfig: AgentRunConfig): Promise<AgentRunResult> {
        const ptcConfig = agentConfig;
        const model = agentConfig.model ?? config.anthropic.investigationModel;
        const maxTurns = agentConfig.maxTurns ?? 10;
        const maxTokens = agentConfig.maxTokens ?? 4096;
        const temperature = agentConfig.temperature ?? 0;
        const allToolCalls: ToolCallRecord[] = [];
        const allTextBlocks: string[] = [];
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let turns = 0;
        let containerId = ptcConfig.containerId;
        let lastModel = model;
        // Build tools array: client tools + optional code_execution server tool
        const tools: Record<string, unknown>[] = agentConfig.tools.map((t) => ({
            type: 'custom',
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
        }));
        if (ptcConfig.useCodeExecution) {
            tools.push({
                type: 'code_execution_20250522',
                name: 'code_execution',
            });
        }
        // Initial messages
        const messages: BetaMessageParam[] = [
            { role: 'user' as const, content: agentConfig.userPrompt },
        ];
        // Main loop
        while (turns < maxTurns) {
            if (agentConfig.signal?.aborted) {
                break;
            }
            turns++;
            const response = await this.client.beta.messages.create({
                model,
                max_tokens: maxTokens,
                temperature,
                system: agentConfig.systemPrompt,
                messages,
                tools: tools as any,
                ...(containerId ? { container: containerId } : {}),
            } as any);
            // Track usage
            if (response.usage) {
                totalInputTokens += response.usage.input_tokens;
                totalOutputTokens += response.usage.output_tokens;
            }
            lastModel = response.model ?? model;
            // Track container ID for reuse
            if (response.container?.id) {
                containerId = response.container.id;
            }
            // Collect text blocks and process content
            const toolUseBlocks = [];
            for (const block of response.content) {
                if (block.type === 'text') {
                    allTextBlocks.push(block.text);
                }
                else if (block.type === 'tool_use') {
                    // Client-side tool — we need to handle it
                    toolUseBlocks.push({
                        id: block.id,
                        name: block.name,
                        input: block.input,
                    });
                }
                // server_tool_use (code_execution, web_search) — handled server-side, no action needed
                // code_execution_tool_result — results from server-side code execution
            }
            // If stop_reason is not tool_use, we're done (end_turn, max_tokens, pause_turn, etc.)
            if (response.stop_reason !== 'tool_use') {
                // For pause_turn, add assistant message and continue the loop
                if (response.stop_reason === 'pause_turn') {
                    messages.push({ role: 'assistant' as const, content: response.content as unknown as BetaContentBlockParam[] });
                    continue;
                }
                break;
            }
            // Handle client-side tool calls
            if (toolUseBlocks.length > 0) {
                // Add assistant message with all content blocks
                messages.push({ role: 'assistant' as const, content: response.content as unknown as BetaContentBlockParam[] });
                // Build tool results
                const toolResults = [];
                for (const toolUse of toolUseBlocks) {
                    let output;
                    let isError = false;
                    try {
                        output = await agentConfig.toolHandler(toolUse.name, toolUse.input as Record<string, unknown>);
                    }
                    catch (err) {
                        output = err instanceof Error ? err.message : String(err);
                        isError = true;
                    }
                    allToolCalls.push({
                        name: toolUse.name,
                        input: toolUse.input as Record<string, unknown>,
                        output,
                    });
                    toolResults.push({
                        type: 'tool_result' as const,
                        tool_use_id: toolUse.id,
                        content: output,
                        is_error: isError,
                    });
                }
                messages.push({ role: 'user' as const, content: toolResults as BetaToolResultBlockParam[] });
            }
        }
        return {
            response: allTextBlocks.join('\n\n') || '',
            toolCalls: allToolCalls,
            totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
            turns,
            model: lastModel,
            costUsd: calculateCost(model, totalInputTokens, totalOutputTokens),
        };
    }
}
