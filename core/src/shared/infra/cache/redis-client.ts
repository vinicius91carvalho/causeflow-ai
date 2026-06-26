import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';
import { instrumentedCall } from '../observability/outbound.js';
let redis: Redis | null = null;
export function getRedisClient(): Redis {
    if (!redis) {
        redis = new Redis(config.redis.url, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        });
        redis.on('error', (err) => {
            logger.error({ err }, 'Redis connection error');
        });
        redis.on('connect', () => {
            logger.debug('Redis connected');
        });
    }
    return redis;
}
export async function closeRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}

export function redisGet(key: string): Promise<string | null> {
    return instrumentedCall('redis', 'get', () => getRedisClient().get(key));
}

export function redisSet(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (ttlSeconds !== undefined) {
        return instrumentedCall('redis', 'set', () => getRedisClient().set(key, value, 'EX', ttlSeconds));
    }
    return instrumentedCall('redis', 'set', () => getRedisClient().set(key, value));
}

export function redisDel(key: string): Promise<number> {
    return instrumentedCall('redis', 'del', () => getRedisClient().del(key));
}
