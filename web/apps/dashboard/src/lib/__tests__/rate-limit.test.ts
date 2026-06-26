import { describe, expect, it } from 'vitest';
import { getClientIp, rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  // Use unique keys to avoid test interference
  const makeKey = (suffix: string) => `test-${Date.now()}-${suffix}`;

  it('allows requests within the limit', () => {
    const key = makeKey('allow');
    const result = rateLimit(key, { limit: 3, windowMs: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('tracks multiple requests', () => {
    const key = makeKey('track');
    rateLimit(key, { limit: 3, windowMs: 60000 });
    rateLimit(key, { limit: 3, windowMs: 60000 });
    const result = rateLimit(key, { limit: 3, windowMs: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('blocks requests when limit is exceeded', () => {
    const key = makeKey('block');
    rateLimit(key, { limit: 2, windowMs: 60000 });
    rateLimit(key, { limit: 2, windowMs: 60000 });
    const result = rateLimit(key, { limit: 2, windowMs: 60000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('includes a resetAt timestamp', () => {
    const key = makeKey('reset');
    const before = Date.now();
    const result = rateLimit(key, { limit: 5, windowMs: 60000 });
    const after = Date.now();
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
    expect(result.resetAt).toBeLessThanOrEqual(after + 60000);
  });
});

describe('getClientIp', () => {
  it('returns x-forwarded-for when present', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    });
    expect(getClientIp(request)).toBe('192.168.1.1');
  });

  it('returns x-real-ip as fallback', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.10.10.10' },
    });
    expect(getClientIp(request)).toBe('10.10.10.10');
  });

  it('returns "unknown" when no IP headers present', () => {
    const request = new Request('http://localhost');
    expect(getClientIp(request)).toBe('unknown');
  });
});
