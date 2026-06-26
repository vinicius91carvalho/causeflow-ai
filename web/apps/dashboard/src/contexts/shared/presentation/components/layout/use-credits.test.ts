import { describe, expect, it } from 'vitest';

describe('useCredits', () => {
  it('exports useCredits hook', async () => {
    const mod = await import('./use-credits');
    expect(mod.useCredits).toBeDefined();
  });
});
