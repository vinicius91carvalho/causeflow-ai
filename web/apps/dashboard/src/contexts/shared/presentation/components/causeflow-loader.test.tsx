import { describe, expect, it } from 'vitest';

describe('CauseFlowLoader', () => {
  it('exports CauseFlowLoader component', async () => {
    const mod = await import('./causeflow-loader');
    expect(mod.CauseFlowLoader).toBeDefined();
  });
});
