/* eslint-disable */
import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const redis = new Redis(config.redis.url);

export class CacheRepository {
  async get<T>(key: string): Promise<T | null> {
    if (!config.featureFlags.cacheEnabled) return null;
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!config.featureFlags.cacheEnabled) return;
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await redis.del(key);
  }

  async healthCheck(): Promise<boolean> {
    const result = await redis.ping();
    return result === 'PONG';
  }
}
