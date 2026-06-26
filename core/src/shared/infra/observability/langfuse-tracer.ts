import Langfuse from 'langfuse';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';
import type { Tracer, Span, SpanAttributes, TraceContext, SpanType, LLMUsage } from '../../application/ports/tracer.port.js';
class LangfuseSpan implements Span {
    trace: any;
    observation: any;
    constructor(trace: any, observation: any) {
        this.trace = trace;
        this.observation = observation;
    }
    setAttribute(key: string, value: string | number | boolean) {
        this.observation.update({ metadata: { [key]: value } });
    }
    setInput(input: unknown) {
        this.observation.update({ input });
        this.trace.update({ input });
    }
    setOutput(output: unknown) {
        this.observation.update({ output });
        this.trace.update({ output });
    }
    setUsage(usage: LLMUsage) {
        this.observation.update({
            model: usage.model,
            usage: {
                input: usage.inputTokens,
                output: usage.outputTokens,
            },
            ...(usage.totalCostUsd != null && { calculatedTotalCost: usage.totalCostUsd }),
        });
    }
    setStatus(status: 'ok' | 'error', message?: string) {
        this.observation.update({
            level: status === 'error' ? 'ERROR' : 'DEFAULT',
            statusMessage: message,
        });
    }
    end() {
        this.observation.end();
    }
}
export class LangfuseTracer implements Tracer {
    client;
    constructor() {
        this.client = new Langfuse({
            publicKey: config.langfuse.publicKey,
            secretKey: config.langfuse.secretKey,
            baseUrl: config.langfuse.baseUrl,
        });
    }
    startSpan(name: string, attributes?: SpanAttributes, context?: TraceContext, type: SpanType = 'span'): Span {
        const trace = this.client.trace({
            name,
            metadata: attributes,
            ...(context?.sessionId && { sessionId: context.sessionId }),
            ...(context?.userId && { userId: context.userId }),
        });
        const observation = type === 'generation'
            ? trace.generation({ name, metadata: attributes })
            : trace.span({ name, metadata: attributes });
        return new LangfuseSpan(trace, observation);
    }
    async flush(): Promise<void> {
        try {
            await this.client.flushAsync();
        }
        catch (err) {
            logger.warn({ err }, 'Failed to flush Langfuse traces');
        }
    }
    async shutdown(): Promise<void> {
        try {
            await this.client.shutdownAsync();
        }
        catch (err) {
            logger.warn({ err }, 'Failed to shutdown Langfuse');
        }
    }
}
