import { describe, it, expect } from 'vitest';
import { ReplayCache } from '../../src/transport/replay-cache.js';

describe('ReplayCache', () => {
  it('tracks seen ids', () => {
    const c = new ReplayCache({ ttlMs: 5000, maxEntries: 100 });
    expect(c.check('abc').seen).toBe(false);
    expect(c.check('abc').seen).toBe(true);
  });

  it('evicts when maxEntries exceeded', () => {
    const c = new ReplayCache({ ttlMs: 60000, maxEntries: 2 });
    c.check('a');
    c.check('b');
    c.check('c');
    expect(c.size()).toBeLessThanOrEqual(2);
  });
});
