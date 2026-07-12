/**
 * Integration test setup for the open-source local runtime (AC-050).
 *
 * Connects to `causeflow-postgres` and `redis` — the same services that
 * `docker compose up -d` provides. No ministack, no DynamoDB, no SQS.
 *
 * Exports helpers for Postgres queries and Redis/BullMQ operations.
 */
import { Pool } from 'pg';
import Redis from 'ioredis';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://causeflow:causeflow@localhost:5439/causeflow';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

let pgPool: Pool | null = null;
let redisClient: Redis | null = null;

export function getPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pgPool;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 5000,
    });
  }
  return redisClient;
}

export async function waitForPostgres(retries = 15): Promise<void> {
  const pool = getPgPool();
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      if (i === retries - 1) throw new Error(`Postgres not ready after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function waitForRedis(retries = 15): Promise<void> {
  const redis = getRedisClient();
  await redis.connect();
  for (let i = 0; i < retries; i++) {
    try {
      const pong = await redis.ping();
      if (pong === 'PONG') return;
    } catch {
      if (i === retries - 1) throw new Error(`Redis not ready after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function closeConnections(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}

export { DATABASE_URL, REDIS_URL };
