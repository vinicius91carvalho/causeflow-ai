/* eslint-disable */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'payments',
    user: process.env.DB_USER ?? 'payment_svc',
    password: process.env.DB_PASSWORD ?? '',
    pool: { min: 5, max: 20 },
    idleTimeoutMs: 30000,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
  featureFlags: {
    enableBatchProcessing: process.env.ENABLE_BATCH === 'true',
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  },
};
