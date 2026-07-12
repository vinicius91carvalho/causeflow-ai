import type {
  LLMClient,
  CompletionParams,
  CompletionResult,
} from '../../application/ports/llm-client.port.js';
import type { Tracer, TraceContext } from '../../application/ports/tracer.port.js';
import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
import { currentTraceId } from '../observability/propagation.js';
export class ObservedAnthropicClient {
  inner;
  tracer;
  metrics;
  traceContext;
  constructor(
    inner: LLMClient,
    tracer: Tracer,
    metrics: MetricRecorder,
    traceContext?: TraceContext,
  ) {
    this.inner = inner;
    this.tracer = tracer;
    this.metrics = metrics;
    this.traceContext = traceContext;
  }
  async complete<T>(params: CompletionParams): Promise<CompletionResult<T>> {
    const span = this.tracer.startSpan(
      'llm.complete',
      {
        maxTokens: params.maxTokens,
        hasSchema: params.responseSchema ? 'true' : 'false',
        ...(params.attributes ?? {}),
      },
      this.traceContext,
      'generation',
    );
    // OTel-Langfuse bridge: set the OTel trace ID as a Langfuse span attribute
    const otelTraceId = currentTraceId();
    if (otelTraceId) {
      span.setAttribute('otelTraceId', otelTraceId);
    }

    span.setInput({
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      model: params.model,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    });
    const startMs = Date.now();
    try {
      const result = await this.inner.complete<T>(params);
      const latencyMs = Date.now() - startMs;
      span.setUsage({
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      span.setAttribute('latencyMs', latencyMs);
      span.setOutput(result.content);
      span.setStatus('ok');
      this.metrics.increment('llm.calls', 1, { model: result.model });
      this.metrics.histogram('llm.latency_ms', latencyMs, { model: result.model });
      this.metrics.increment('llm.input_tokens', result.usage.inputTokens, { model: result.model });
      this.metrics.increment('llm.output_tokens', result.usage.outputTokens, {
        model: result.model,
      });
      this.metrics.histogram('llm.cost_usd', result.costUsd, { model: result.model });
      return result;
    } catch (err) {
      span.setOutput({ error: err instanceof Error ? err.message : 'Unknown error' });
      span.setStatus('error', err instanceof Error ? err.message : 'Unknown error');
      this.metrics.increment('llm.errors', 1, { model: params.model ?? 'default' });
      throw err;
    } finally {
      span.end();
    }
  }
}
