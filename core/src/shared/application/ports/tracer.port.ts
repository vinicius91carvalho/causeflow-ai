export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}

/** Context propagated to the trace (not the span). */
export interface TraceContext {
    /** Groups traces into a session (e.g. investigation ID). */
    sessionId?: string;
    /** Associates traces with a user/tenant (e.g. organization ID). */
    userId?: string;
}

export interface LLMUsage {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalCostUsd?: number;
}

export interface Span {
    setAttribute(key: string, value: string | number | boolean): void;
    setInput(input: unknown): void;
    setOutput(output: unknown): void;
    /** Sets LLM usage — enables native cost tracking in Langfuse generations. */
    setUsage(usage: LLMUsage): void;
    setStatus(status: 'ok' | 'error', message?: string): void;
    end(): void;
}

export type SpanType = 'span' | 'generation';

export interface Tracer {
    startSpan(name: string, attributes?: SpanAttributes, context?: TraceContext, type?: SpanType): Span;
    flush(): Promise<void>;
    shutdown(): Promise<void>;
}
