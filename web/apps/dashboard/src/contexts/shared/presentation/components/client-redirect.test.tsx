import { describe, expect, it } from 'vitest';

describe('ClientRedirect', () => {
  it('exports ClientRedirect component', async () => {
    const mod = await import('./client-redirect');
    expect(mod.ClientRedirect).toBeDefined();
  });
});
