import Anthropic from '@anthropic-ai/sdk';
import { calculateCost } from '../../domain/cost.js';
import { config } from '../../config/index.js';
import type { AgentRunner, AgentRunConfig, AgentRunResult, ToolCallRecord } from '../../application/ports/agent-runner.port.js';
export class AnthropicAgentRunner {
    client;
    constructor() {
        this.client = new Anthropic({
            apiKey: config.anthropic.apiKey,
            ...(config.anthropic.baseUrl && { baseURL: config.anthropic.baseUrl }),
        });
    }
    async run(agentConfig: AgentRunConfig): Promise<AgentRunResult> {
        const model = agentConfig.model ?? config.anthropic.investigationModel;
        const maxTurns = agentConfig.maxTurns ?? 10;
        const maxTokens = agentConfig.maxTokens ?? 4096;
        const temperature = agentConfig.temperature ?? 0;
        const allToolCalls: ToolCallRecord[] = [];
        const runnableTools = agentConfig.tools.map((t) => ({
            type: 'custom' as const,
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema,
            parse: (content: string) => content,
            async run(input: Record<string, unknown>): Promise<string> {
                let output: string;
                try {
                    output = await agentConfig.toolHandler(t.name, input);
                }
                catch (err) {
                    output = err instanceof Error ? err.message : String(err);
                    allToolCalls.push({ name: t.name, input, output });
                    throw err;
                }
                allToolCalls.push({ name: t.name, input, output });
                return output;
            },
        }));
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let turns = 0;
        const runner = this.client.beta.messages.toolRunner({
            model,
            max_tokens: maxTokens,
            temperature,
            system: agentConfig.systemPrompt,
            messages: [{ role: 'user' as const, content: agentConfig.userPrompt }],
            tools: runnableTools as any,
            max_iterations: maxTurns,
        } as any);
        const allTextBlocks: string[] = [];
        let lastMessage: any;
        for await (const message of runner) {
            if (agentConfig.signal?.aborted)
                break;
            const betaMsg = message as any;
            if (betaMsg.usage) {
                totalInputTokens += betaMsg.usage.input_tokens;
                totalOutputTokens += betaMsg.usage.output_tokens;
            }
            // Capture text blocks from every message (not just the last)
            for (const block of betaMsg.content ?? []) {
                if ((block as any).type === 'text' && (block as any).text) {
                    allTextBlocks.push((block as any).text);
                }
            }
            turns++;
            lastMessage = betaMsg;
        }
        const response = allTextBlocks.join('\n\n') || '';
        return {
            response,
            toolCalls: allToolCalls,
            totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
            turns,
            model: lastMessage?.model ?? model,
            costUsd: calculateCost(model, totalInputTokens, totalOutputTokens),
        };
    }
}
