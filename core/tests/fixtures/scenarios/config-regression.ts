import type { FixtureScenario } from './index.js';

export const configRegression: FixtureScenario = {
  name: 'config-regression',
  description: 'Configuration regression: request timeout changed from 30s to 3s (typo)',

  commits: [
    {
      sha: 'cr01aaaa',
      message: 'feat: add request timeout configuration',
      author: 'dev@acme.com',
      date: '2026-02-13T10:00:00Z',
      files: [{ filename: 'src/config.ts', status: 'modified', additions: 3, deletions: 0 }],
    },
    {
      sha: 'cr02bbbb',
      message: 'fix: adjust timeout values for production',
      author: 'dev@acme.com',
      date: '2026-02-14T16:00:00Z',
      files: [
        { filename: 'src/config.ts', status: 'modified', additions: 1, deletions: 1 },
        { filename: '.env.example', status: 'modified', additions: 1, deletions: 1 },
      ],
    },
    {
      sha: 'cr03cccc',
      message: 'chore: cleanup unused imports',
      author: 'dev@acme.com',
      date: '2026-02-14T17:00:00Z',
      files: [{ filename: 'src/index.ts', status: 'modified', additions: 0, deletions: 3 }],
    },
    {
      sha: 'cr04dddd',
      message: 'ci: deploy v2.14.6 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-15T08:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    cr02bbbb: {
      sha: 'cr02bbbb',
      message: 'fix: adjust timeout values for production',
      files: [
        {
          filename: 'src/config.ts',
          status: 'modified',
          patch: `@@ -12,7 +12,7 @@ export const config = {
   redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
-  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
+  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 3000),
+  // BUG: typo — 3000ms (3s) instead of 30000ms (30s)
   featureFlags: {`,
        },
        {
          filename: '.env.example',
          status: 'modified',
          patch: `@@ -8,4 +8,4 @@
-REQUEST_TIMEOUT_MS=30000
+REQUEST_TIMEOUT_MS=3000`,
        },
      ],
    },
  },

  files: {
    'src/config.ts': {
      path: 'src/config.ts',
      content: `export const config = {
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
  redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 3000),
  // BUG: 3000ms (3s) instead of 30000ms (30s) — causes request timeouts
  featureFlags: {
    enableBatchProcessing: process.env.ENABLE_BATCH === 'true',
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  },
};`,
      size: 450,
      sha: 'cr_file1',
    },
    '.env.example': {
      path: '.env.example',
      content: `PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=payments
DB_USER=payment_svc
DB_PASSWORD=change_me
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
ENABLE_BATCH=false
CACHE_ENABLED=true
REQUEST_TIMEOUT_MS=3000`,
      size: 200,
      sha: 'cr_file2',
    },
  },

  deployments: [
    {
      id: 606,
      sha: 'cr04dddd',
      environment: 'production',
      createdAt: '2026-02-15T08:15:00Z',
      status: 'success',
    },
  ],
};
