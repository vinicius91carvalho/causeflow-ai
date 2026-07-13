import { describe, expect, it } from 'vitest';
import { useCredits } from './use-credits';

describe('useCredits (AC-074 OSS no-op)', () => {
  it('exports useCredits hook', async () => {
    const mod = await import('./use-credits');
    expect(mod.useCredits).toBeDefined();
  });

  it('never surfaces remaining-credit limits', () => {
    const state = useCredits({ initialCreditsRemaining: 3 });
    expect(state.credits).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBe(false);
  });
});
