/**
 * E2E test setup for the open-source local runtime (AC-050).
 *
 * Waits for the OSS stack services: Postgres and Redis.
 * No ministack / LocalStack, no CloudWatch, no DynamoDB.
 *
 * The E2E harness (e2e-test-harness.ts) calls bootstrap() directly with
 * stubbed LLM/agent runners, so the test infrastructure only needs the
 * persistence layer to be available.
 *
 * Default env vars for the OSS runtime are set here so E2E tests can run
 * without requiring a .env.e2e file.
 */
import { Pool } from 'pg';
import Redis from 'ioredis';

// Set default env vars for OSS runtime if not already set
process.env['CAUSEFLOW_RUNTIME'] ??= 'oss';
process.env['NODE_ENV'] ??= 'test';
process.env['JWT_SECRET'] ??= 'e2e-test-jwt-secret';
process.env['TOKEN_ENCRYPTION_KEY'] ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env['WEBHOOK_SECRET'] ??= 'e2e-webhook-secret';
process.env['HINDSIGHT_BASE_URL'] ??= 'http://localhost:8888';
process.env['DATABASE_URL'] ??= 'postgresql://causeflow:causeflow@localhost:5439/causeflow';
process.env['REDIS_URL'] ??= 'redis://localhost:6380';

const DATABASE_URL = process.env['DATABASE_URL'];
const REDIS_URL = process.env['REDIS_URL'];

export async function setup(): Promise<void> {
  console.log('[E2E Setup] Waiting for OSS infrastructure...');
  await Promise.all([waitForPostgres(), waitForRedis()]);
  // Queue flush runs in createE2EHarness() for in-process tests only. Black-box
  // tests (AC-046) hit a running API and must not delete its BullMQ keys.
  console.log('[E2E Setup] All OSS infrastructure ready!');
}

async function waitForPostgres(retries = 15): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  let ready = false;
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[E2E Setup] Postgres ready');
      ready = true;
      break;
    } catch {
      if (i === retries - 1) {
        await pool.end();
        throw new Error(`Postgres not ready after ${retries} retries`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!ready) {
    await pool.end();
    throw new Error(`Postgres not ready after ${retries} retries`);
  }

  await pool.end();
}

async function waitForRedis(retries = 15): Promise<void> {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5000,
  });

  try {
    await redis.connect();
    for (let i = 0; i < retries; i++) {
      try {
        const pong = await redis.ping();
        if (pong === 'PONG') {
          console.log('[E2E Setup] Redis ready');
          return;
        }
      } catch {
        if (i === retries - 1) throw new Error(`Redis not ready after ${retries} retries`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } finally {
    await redis.quit().catch(() => {});
  }
}
