import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    langfuse: { publicKey: undefined, secretKey: undefined, baseUrl: undefined },
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

describe('createObservabilityStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return noop stack when langfuse is not configured', async () => {
    const { createObservabilityStack } = await import('../../../../src/shared/infra/observability/observability-factory.js');
    const stack = await createObservabilityStack();

    expect(stack.tracer).toBeDefined();
    expect(stack.metrics).toBeDefined();

    // Should not throw
    const span = stack.tracer.startSpan('test');
    span.setAttribute('key', 'value');
    span.setStatus('ok');
    span.end();
    stack.metrics.increment('test.counter');
    stack.metrics.gauge('test.gauge', 42);
    stack.metrics.histogram('test.histogram', 100);
  });
});
