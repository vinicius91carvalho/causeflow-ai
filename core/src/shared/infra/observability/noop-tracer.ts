import type { Tracer, Span, SpanAttributes, TraceContext, SpanType, LLMUsage } from '../../application/ports/tracer.port.js';
class NoopSpan implements Span {
    setAttribute(_key: string, _value: string | number | boolean) { }
    setInput(_input: unknown) { }
    setOutput(_output: unknown) { }
    setUsage(_usage: LLMUsage) { }
    setStatus(_status: 'ok' | 'error', _message?: string) { }
    end() { }
}
export class NoopTracer implements Tracer {
    startSpan(_name: string, _attributes?: SpanAttributes, _context?: TraceContext, _type?: SpanType): Span {
        return new NoopSpan();
    }
    async flush(): Promise<void> { }
    async shutdown(): Promise<void> { }
}
