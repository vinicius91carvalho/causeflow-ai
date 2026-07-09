/**
 * Shared Redis connection for BullMQ.
 *
 * BullMQ requires a dedicated Redis connection with `maxRetriesPerRequest: null`
 * so the blocking BRPOPLPUSH command does not get retried automatically.
 * We create a separate ioredis instance for BullMQ rather than sharing the
 * existing getRedisClient() connection (which uses maxRetriesPerRequest: 3).
 */
import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

let bullRedis: Redis | null = null;

export function getBullRedisConnection(): Redis {
  if (!bullRedis) {
    bullRedis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    bullRedis.on('error', (err) => {
      logger.error({ err }, 'BullMQ Redis connection error');
    });
    bullRedis.on('connect', () => {
      logger.debug('BullMQ Redis connected');
    });
  }
  return bullRedis;
}

export async function closeBullRedis(): Promise<void> {
  if (bullRedis) {
    await bullRedis.quit();
    bullRedis = null;
  }
}

/**
 * BullMQ v5 type-checks connection options against its internal IORedis.Redis
 * type which may differ slightly from the standalone ioredis types. This cast
 * is safe at runtime — it is the same ioredis instance, just different TS
 * interface versions between BullMQ's bundled types and the project's ioredis.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asBullConnection(): any {
  return getBullRedisConnection();
}
