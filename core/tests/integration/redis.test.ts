import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Redis from 'ioredis';
import { getRedisClient, waitForRedis } from './setup.js';

describe('Redis Integration', () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = getRedisClient();
    await waitForRedis(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('should ping successfully', async () => {
    const result = await redis.ping();
    expect(result).toBe('PONG');
  });

  it('should set and get a string value', async () => {
    await redis.set('test:key1', 'hello-causeflow');
    const result = await redis.get('test:key1');
    expect(result).toBe('hello-causeflow');

    // Cleanup
    await redis.del('test:key1');
  });

  it('should support INCR for rate limiting', async () => {
    const key = 'ratelimit:test-tenant:window-1';

    const count1 = await redis.incr(key);
    expect(count1).toBe(1);

    const count2 = await redis.incr(key);
    expect(count2).toBe(2);

    const count3 = await redis.incr(key);
    expect(count3).toBe(3);

    // Cleanup
    await redis.del(key);
  });

  it('should support EXPIRE for TTL', async () => {
    const key = 'test:expiring';
    await redis.set(key, 'will-expire');
    await redis.expire(key, 2);

    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(2);

    const value = await redis.get(key);
    expect(value).toBe('will-expire');

    // Cleanup
    await redis.del(key);
  });

  it('should support rate limit window pattern (INCR + EXPIRE)', async () => {
    const windowSeconds = 60;
    const windowKey = `ratelimit:test-tenant:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const maxRequests = 100;

    // Simulate rate limiting
    const count = await redis.incr(windowKey);
    if (count === 1) {
      await redis.expire(windowKey, windowSeconds);
    }

    expect(count).toBe(1);
    expect(count).toBeLessThanOrEqual(maxRequests);

    // Second request
    const count2 = await redis.incr(windowKey);
    expect(count2).toBe(2);

    // Cleanup
    await redis.del(windowKey);
  });

  it('should support hash operations', async () => {
    const key = 'test:hash';
    await redis.hset(key, 'field1', 'value1');
    await redis.hset(key, 'field2', 'value2');

    const val1 = await redis.hget(key, 'field1');
    expect(val1).toBe('value1');

    const all = await redis.hgetall(key);
    expect(all).toEqual({ field1: 'value1', field2: 'value2' });

    // Cleanup
    await redis.del(key);
  });

  it('should return null for non-existing keys', async () => {
    const result = await redis.get('non-existing-key-xyz');
    expect(result).toBeNull();
  });
});
