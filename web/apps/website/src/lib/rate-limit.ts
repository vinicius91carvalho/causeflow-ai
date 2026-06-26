export interface RateLimitOptions {
  interval: number;
  uniqueTokenPerInterval: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export interface RateLimiter {
  check(limit: number, token: string): Promise<RateLimitResult>;
}

export function rateLimit(options: RateLimitOptions): RateLimiter {
  const { interval, uniqueTokenPerInterval } = options;
  const tokenCache = new Map<string, number[]>();

  return {
    check(limit: number, token: string): Promise<RateLimitResult> {
      const now = Date.now();
      const windowStart = now - interval;

      // Clean up stale entries when cache grows too large
      if (tokenCache.size >= uniqueTokenPerInterval) {
        for (const [key, timestamps] of tokenCache.entries()) {
          const fresh = timestamps.filter((ts) => ts > windowStart);
          if (fresh.length === 0) {
            tokenCache.delete(key);
          } else {
            tokenCache.set(key, fresh);
          }
        }
      }

      // Get existing timestamps for this token, filtered to the sliding window
      const existing = tokenCache.get(token) ?? [];
      const windowTimestamps = existing.filter((ts) => ts > windowStart);

      if (windowTimestamps.length >= limit) {
        tokenCache.set(token, windowTimestamps);
        return Promise.resolve({
          success: false,
          remaining: 0,
        });
      }

      // Record this request
      windowTimestamps.push(now);
      tokenCache.set(token, windowTimestamps);

      return Promise.resolve({
        success: true,
        remaining: limit - windowTimestamps.length,
      });
    },
  };
}

// Pre-configured instance: 500 unique tokens per minute
export const apiRateLimit = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });
