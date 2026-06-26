/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach.
 *
 * NOTE: This is a single-instance in-memory store.
 * For multi-instance production deployments, replace with Redis (e.g., Upstash).
 */

export { getClientIp } from '@causeflow/shared/infrastructure/utils/request';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  /** Maximum number of requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/** Track when we last ran a full eviction sweep to avoid doing it on every call. */
let lastEvictionAt = 0;
const EVICTION_INTERVAL_MS = 60_000; // Run full eviction at most once per minute

/**
 * Lazily evict expired entries from the store.
 * Called on every `rateLimit()` invocation, but a full sweep only runs
 * if at least EVICTION_INTERVAL_MS has elapsed since the last one.
 */
function evictExpired(now: number): void {
  if (now - lastEvictionAt < EVICTION_INTERVAL_MS) return;
  lastEvictionAt = now;

  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}

/**
 * Check and increment the rate limit for a given key.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  // Lazy eviction: sweep expired entries periodically to prevent memory leaks
  evictExpired(now);

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { success: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  if (entry.count >= options.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  store.set(key, entry);

  return { success: true, remaining: options.limit - entry.count, resetAt: entry.resetAt };
}
