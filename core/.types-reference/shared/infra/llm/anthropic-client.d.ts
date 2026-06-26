import type { LLMClient, CompletionParams, CompletionResult } from '../../application/ports/llm-client.port.js';
export declare class AnthropicClient implements LLMClient {
    private readonly client;
    private circuitBreaker?;
    constructor();
    setCircuitBreaker(cb: {
        execute: <T>(fn: () => Promise<T>) => Promise<T>;
    }): void;
    private call;
    complete<T>(params: CompletionParams): Promise<CompletionResult<T>>;
    private completeStructured;
}
