import type { Tracer } from '../../application/ports/tracer.port.js';
import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
import { NoopTracer } from './noop-tracer.js';
import { NoopMetricRecorder } from './noop-metric-recorder.js';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

export interface ObservabilityStack {
  tracer: Tracer;
  metrics: MetricRecorder;
}

export async function createObservabilityStack(): Promise<ObservabilityStack> {
  if (config.langfuse.publicKey && config.langfuse.secretKey) {
    logger.info('Langfuse observability enabled');
    // Dynamic import to avoid requiring langfuse when not configured
    const { LangfuseTracer } = await import('./langfuse-tracer.js');
    const { LangfuseMetricRecorder } = await import('./langfuse-metric-recorder.js');
    return {
      tracer: new LangfuseTracer(),
      metrics: new LangfuseMetricRecorder(),
    };
  }

  logger.info('Using noop observability (Langfuse not configured)');
  return {
    tracer: new NoopTracer(),
    metrics: new NoopMetricRecorder(),
  };
}
