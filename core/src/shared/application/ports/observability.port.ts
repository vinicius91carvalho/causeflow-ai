export interface SpanContext {
    traceId: string;
    spanId: string;
}
export interface SpanOptions {
    name: string;
    attributes?: Record<string, string | number | boolean>;
    parentSpan?: SpanContext;
}
export interface Span {
    context: SpanContext;
    setAttribute(key: string, value: string | number | boolean): void;
    setStatus(status: 'ok' | 'error', message?: string): void;
    end(): void;
}
export interface Tracer {
    startSpan(options: SpanOptions): Span;
}
export interface MetricRecorder {
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    histogram(name: string, value: number, tags?: Record<string, string>): void;
}
