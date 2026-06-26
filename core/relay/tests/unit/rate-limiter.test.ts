import { describe, it, expect } from 'vitest';
import { TokenBucket } from '../../src/reliability/rate-limiter.js';

describe('TokenBucket', () => {
  it('allows requests up to burst capacity', () => {
    const b = new TokenBucket({ requestsPerMinute: 60, burstCapacity: 3 });
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false);
  });

  it('refills tokens over time', async () => {
    const b = new TokenBucket({ requestsPerMinute: 6000, burstCapacity: 2 });
    b.tryConsume();
    b.tryConsume();
    expect(b.tryConsume()).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(b.tryConsume()).toBe(true);
  });
});
