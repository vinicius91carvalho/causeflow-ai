import type {
  AgentRunner,
  AgentRunConfig,
  AgentRunResult,
} from '../../application/ports/agent-runner.port.js';
import type { Tracer, TraceContext } from '../../application/ports/tracer.port.js';
import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
import { currentTraceId } from '../observability/propagation.js';
export class ObservedAgentRunner implements AgentRunner {
  inner;
  tracer;
  metrics;
  traceContext;
  constructor(
    inner: AgentRunner,
    tracer: Tracer,
    metrics: MetricRecorder,
    traceContext?: TraceContext,
  ) {
    this.inner = inner;
    this.tracer = tracer;
    this.metrics = metrics;
    this.traceContext = traceContext;
  }
  async run(agentConfig: AgentRunConfig): Promise<AgentRunResult> {
    // Merge per-call traceContext with construction-time traceContext
    const mergedContext = agentConfig.traceContext
      ? { ...this.traceContext, ...agentConfig.traceContext }
      : this.traceContext;

    const span = this.tracer.startSpan(
      'agent.run',
      {
        model: agentConfig.model,
        maxTurns: agentConfig.maxTurns,
        toolCount: agentConfig.tools.length,
        minToolCalls: agentConfig.minToolCalls,
        hasStaticPrompt: !!agentConfig.staticSystemPrompt,
      },
      mergedContext,
    );

    // OTel-Langfuse bridge: set the OTel trace ID as a Langfuse span attribute
    const otelTraceId = currentTraceId();
    if (otelTraceId) {
      span.setAttribute('otelTraceId', otelTraceId);
    }
    span.setInput({
      systemPrompt: agentConfig.staticSystemPrompt
        ? `[static] ${agentConfig.staticSystemPrompt.slice(0, 200)}...\n[dynamic] ${agentConfig.systemPrompt}`
        : agentConfig.systemPrompt,
      userPrompt: agentConfig.userPrompt,
      tools: agentConfig.tools.map((t) => t.name),
      model: agentConfig.model,
      maxTurns: agentConfig.maxTurns,
    });
    const startMs = Date.now();
    try {
      const result = await this.inner.run(agentConfig);
      const latencyMs = Date.now() - startMs;
      // Core metrics
      span.setAttribute('turns', result.turns);
      span.setAttribute('toolCalls', result.toolCalls.length);
      span.setAttribute('latencyMs', latencyMs);
      span.setUsage({
        model: result.model,
        inputTokens: result.totalUsage.inputTokens,
        outputTokens: result.totalUsage.outputTokens,
      });
      // Enhanced metrics (from quacode migration)
      if (result.truncatedResults) span.setAttribute('truncatedResults', result.truncatedResults);
      if (result.parallelBatches) span.setAttribute('parallelBatches', result.parallelBatches);
      if (result.retryCount) span.setAttribute('retryCount', result.retryCount);
      if (result.totalUsage.cacheReadInputTokens)
        span.setAttribute('cacheReadTokens', result.totalUsage.cacheReadInputTokens);
      if (result.totalUsage.cacheCreationInputTokens)
        span.setAttribute('cacheCreationTokens', result.totalUsage.cacheCreationInputTokens);
      span.setOutput({
        response: result.response,
        toolCalls: result.toolCalls.map((tc) => ({
          name: tc.name,
          input: tc.input,
          output: tc.output.slice(0, 500),
        })),
        turns: result.turns,
      });
      span.setStatus('ok');
      // Core counters
      this.metrics.increment('agent.runs', 1, { model: result.model });
      this.metrics.histogram('agent.latency_ms', latencyMs, { model: result.model });
      this.metrics.gauge('agent.turns', result.turns, { model: result.model });
      this.metrics.increment('agent.tool_calls', result.toolCalls.length, { model: result.model });
      this.metrics.increment('agent.input_tokens', result.totalUsage.inputTokens, {
        model: result.model,
      });
      this.metrics.increment('agent.output_tokens', result.totalUsage.outputTokens, {
        model: result.model,
      });
      this.metrics.histogram('agent.cost_usd', result.costUsd, { model: result.model });
      // Enhanced counters (from quacode migration)
      if (result.truncatedResults) {
        this.metrics.increment('agent.truncated_results', result.truncatedResults, {
          model: result.model,
        });
      }
      if (result.parallelBatches) {
        this.metrics.increment('agent.parallel_batches', result.parallelBatches, {
          model: result.model,
        });
      }
      if (result.retryCount) {
        this.metrics.increment('agent.retries', result.retryCount, { model: result.model });
      }
      if (result.totalUsage.cacheReadInputTokens) {
        this.metrics.increment('agent.cache_read_tokens', result.totalUsage.cacheReadInputTokens, {
          model: result.model,
        });
      }
      if (result.totalUsage.cacheCreationInputTokens) {
        this.metrics.increment(
          'agent.cache_creation_tokens',
          result.totalUsage.cacheCreationInputTokens,
          { model: result.model },
        );
      }
      return result;
    } catch (err) {
      span.setOutput({ error: err instanceof Error ? err.message : 'Unknown error' });
      span.setStatus('error', err instanceof Error ? err.message : 'Unknown error');
      this.metrics.increment('agent.errors', 1, { model: agentConfig.model ?? 'default' });
      throw err;
    } finally {
      span.end();
    }
  }
}
