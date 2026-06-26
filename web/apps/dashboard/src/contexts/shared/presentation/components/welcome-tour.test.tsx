import { describe, expect, it } from 'vitest';

describe('WelcomeTour', () => {
  it('exports WelcomeTour component', async () => {
    const mod = await import('./welcome-tour');
    expect(mod.WelcomeTour).toBeDefined();
  });
});
