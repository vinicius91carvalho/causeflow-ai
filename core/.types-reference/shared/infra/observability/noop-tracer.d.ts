import type { Tracer, Span, SpanAttributes } from '../../application/ports/tracer.port.js';
export declare class NoopTracer implements Tracer {
    startSpan(_name: string, _attributes?: SpanAttributes): Span;
    flush(): Promise<void>;
    shutdown(): Promise<void>;
}
