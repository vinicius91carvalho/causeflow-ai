import { describe, expect, it } from 'vitest';

describe('instrumentation', () => {
  it('exports register and onRequestError', async () => {
    const mod = await import('./instrumentation');
    expect(typeof mod.register).toBe('function');
    expect(typeof mod.onRequestError).toBe('function');
  });
});
