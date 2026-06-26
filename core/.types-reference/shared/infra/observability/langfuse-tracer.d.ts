import type { Tracer, Span, SpanAttributes } from '../../application/ports/tracer.port.js';
export declare class LangfuseTracer implements Tracer {
    private readonly client;
    constructor();
    startSpan(name: string, attributes?: SpanAttributes): Span;
    flush(): Promise<void>;
    shutdown(): Promise<void>;
}
