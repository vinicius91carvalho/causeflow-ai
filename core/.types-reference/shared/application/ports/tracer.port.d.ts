export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}
export interface Span {
    setAttribute(key: string, value: string | number | boolean): void;
    setStatus(status: 'ok' | 'error', message?: string): void;
    end(): void;
}
export interface Tracer {
    startSpan(name: string, attributes?: SpanAttributes): Span;
    flush(): Promise<void>;
    shutdown(): Promise<void>;
}
