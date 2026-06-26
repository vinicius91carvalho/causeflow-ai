import { LRUCache } from 'lru-cache';

export interface ReplayCacheOptions {
  ttlMs: number;
  maxEntries: number;
}

export class ReplayCache {
  private cache: LRUCache<string, number>;

  constructor(options: ReplayCacheOptions) {
    this.cache = new LRUCache<string, number>({
      max: options.maxEntries,
      ttl: options.ttlMs,
    });
  }

  check(id: string): { seen: boolean } {
    if (this.cache.has(id)) return { seen: true };
    this.cache.set(id, Date.now());
    return { seen: false };
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
