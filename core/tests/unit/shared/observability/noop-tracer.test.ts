import { describe, it, expect } from 'vitest';
import { NoopTracer } from '../../../../src/shared/infra/observability/noop-tracer.js';

describe('NoopTracer', () => {
  it('should create a span that does nothing', () => {
    const tracer = new NoopTracer();
    const span = tracer.startSpan('test', { key: 'value' });

    // Should not throw
    span.setAttribute('foo', 'bar');
    span.setAttribute('count', 42);
    span.setStatus('ok');
    span.setStatus('error', 'some error');
    span.end();
  });

  it('should resolve flush without error', async () => {
    const tracer = new NoopTracer();
    await expect(tracer.flush()).resolves.toBeUndefined();
  });

  it('should resolve shutdown without error', async () => {
    const tracer = new NoopTracer();
    await expect(tracer.shutdown()).resolves.toBeUndefined();
  });
});
