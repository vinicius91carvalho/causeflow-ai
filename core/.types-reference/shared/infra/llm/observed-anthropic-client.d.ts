import type { LLMClient, CompletionParams, CompletionResult } from '../../application/ports/llm-client.port.js';
import type { Tracer } from '../../application/ports/tracer.port.js';
import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
export declare class ObservedAnthropicClient implements LLMClient {
    private readonly inner;
    private readonly tracer;
    private readonly metrics;
    constructor(inner: LLMClient, tracer: Tracer, metrics: MetricRecorder);
    complete<T>(params: CompletionParams): Promise<CompletionResult<T>>;
}
