import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '../../../domain/errors.js';
import { getRedisClient } from '../../cache/redis-client.js';
import { config } from '../../../config/index.js';
import type { AppEnv } from '../hono-types.js';
// In-memory fallback when Redis is unavailable (fail-closed instead of fail-open)
const memoryCounters = new Map();
const MEMORY_CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();
function memoryIncr(key: string, windowSeconds: number) {
  const now = Date.now();
  // Periodic cleanup of expired entries to prevent memory leak
  if (now - lastCleanup > MEMORY_CLEANUP_INTERVAL) {
    for (const [k, v] of memoryCounters) {
      if (v.expiresAt < now) memoryCounters.delete(k);
    }
    lastCleanup = now;
  }
  const existing = memoryCounters.get(key);
  if (existing && existing.expiresAt > now) {
    existing.count++;
    return existing.count;
  }
  memoryCounters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
  return 1;
}
export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;
  if (path === '/health' || path === '/health/detailed' || path === '/admin/queues') return next();
  const tenantId = c.get('tenantId') ?? 'anonymous';
  const windowSeconds = config.rateLimit.windowSeconds;
  const key = `ratelimit:${tenantId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  // Resolve max requests from tenant plan (set by tenant middleware)
  const tenantPlan = c.get('tenantPlan') ?? 'default';
  const maxRequests =
    config.rateLimit.plans[tenantPlan as keyof typeof config.rateLimit.plans] ??
    config.rateLimit.default;
  let count;
  try {
    const redis = getRedisClient();
    count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
  } catch {
    // Redis down — use in-memory fallback (fail-closed, still rate limits)
    count = memoryIncr(key, windowSeconds);
  }
  c.header('X-RateLimit-Limit', String(maxRequests));
  c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
  if (count > maxRequests) {
    throw new RateLimitError(windowSeconds);
  }
  return next();
});
