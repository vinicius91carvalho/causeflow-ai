export interface RateLimitOptions {
  requestsPerMinute: number;
  burstCapacity: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly refillPerMs: number;
  private readonly capacity: number;

  constructor(options: RateLimitOptions) {
    this.capacity = options.burstCapacity;
    this.tokens = options.burstCapacity;
    this.lastRefill = Date.now();
    this.refillPerMs = options.requestsPerMinute / 60_000;
  }

  tryConsume(cost = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }
}

export class RateLimiterRegistry {
  private buckets = new Map<string, TokenBucket>();

  configure(key: string, options: RateLimitOptions): void {
    this.buckets.set(key, new TokenBucket(options));
  }

  tryConsume(key: string): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket) return true;
    return bucket.tryConsume();
  }
}
