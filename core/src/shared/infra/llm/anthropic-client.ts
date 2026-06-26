import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { calculateCost } from '../../domain/cost.js';
import { config } from '../../config/index.js';
import type { LLMClient, CompletionParams, CompletionResult } from '../../application/ports/llm-client.port.js';
import { instrumentedCall } from '../observability/outbound.js';
const UNSUPPORTED_SCHEMA_PROPS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
    'multipleOf', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minProperties', 'maxProperties'];
function sanitizeSchema(schema: unknown): unknown {
    if (Array.isArray(schema))
        return schema.map(sanitizeSchema);
    if (schema === null || typeof schema !== 'object')
        return schema;
    const obj = schema as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (UNSUPPORTED_SCHEMA_PROPS.includes(key))
            continue;
        result[key] = sanitizeSchema(value);
    }
    if (result['type'] === 'object') {
        result['additionalProperties'] = false;
    }
    return result;
}
export class AnthropicClient {
    client;
    circuitBreaker?: { execute: <T>(fn: () => Promise<T>) => Promise<T> };
    constructor() {
        this.client = new Anthropic({
            apiKey: config.anthropic.apiKey,
            ...(config.anthropic.baseUrl && { baseURL: config.anthropic.baseUrl }),
        });
    }
    setCircuitBreaker(cb: { execute: <T>(fn: () => Promise<T>) => Promise<T> }): void {
        this.circuitBreaker = cb;
    }
    call<T>(fn: () => Promise<T>): Promise<T> {
        return this.circuitBreaker ? this.circuitBreaker.execute(fn) : fn();
    }
    async complete<T>(params: CompletionParams): Promise<CompletionResult<T>> {
        const model = params.model ?? config.anthropic.triageModel;
        if (params.responseSchema) {
            return this.completeStructured(params, model);
        }
        const response = await instrumentedCall('anthropic', 'messages', () => this.call(() => this.client.messages.create({
            model,
            max_tokens: params.maxTokens,
            temperature: params.temperature ?? 0,
            system: params.systemPrompt,
            messages: [{ role: 'user', content: params.userPrompt }],
        })), { attributes: { model } });
        const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string } | undefined;
        const raw = textBlock?.text ?? '';
        const usage = {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        };
        return {
            content: raw as T,
            usage,
            model: response.model,
            costUsd: calculateCost(response.model, usage.inputTokens, usage.outputTokens),
        };
    }
    async completeStructured<T>(params: CompletionParams, model: string): Promise<CompletionResult<T>> {
        const { $schema: _, ...rawSchema } = zodToJsonSchema(params.responseSchema!);
        const jsonSchema = sanitizeSchema(rawSchema);
        const response = await instrumentedCall('anthropic', 'messages.structured', () => this.call(() => this.client.messages.create({
            model,
            max_tokens: params.maxTokens,
            temperature: params.temperature ?? 0,
            system: params.systemPrompt,
            messages: [{ role: 'user', content: params.userPrompt }],
            output_config: {
                format: {
                    type: 'json_schema',
                    schema: jsonSchema as Record<string, unknown>,
                },
            },
        } as Parameters<typeof this.client.messages.create>[0])), { attributes: { model } }) as Anthropic.Message;
        const textBlock = response.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined;
        if (!textBlock || textBlock.type !== 'text') {
            throw new Error('Expected text block for structured output');
        }
        const parsed = JSON.parse(textBlock.text);
        const validated = params.responseSchema!.parse(parsed);
        const usage = {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        };
        return {
            content: validated as T,
            usage,
            model: response.model,
            costUsd: calculateCost(response.model, usage.inputTokens, usage.outputTokens),
        };
    }
}
