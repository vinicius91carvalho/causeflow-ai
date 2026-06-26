import type { FixtureScenario } from './index.js';

export const featureFlagBug: FixtureScenario = {
  name: 'feature-flag-bug',
  description: 'Feature flag batch processing enabled in production without proper testing',

  commits: [
    {
      sha: 'ff01aaaa',
      message: 'feat: implement batch payment processing mode',
      author: 'dev@acme.com',
      date: '2026-02-12T10:00:00Z',
      files: [
        { filename: 'src/services/payment.service.ts', status: 'modified', additions: 25, deletions: 0 },
        { filename: 'src/config.ts', status: 'modified', additions: 1, deletions: 0 },
      ],
    },
    {
      sha: 'ff02bbbb',
      message: 'ops: enable batch processing in production for load test',
      author: 'ops@acme.com',
      date: '2026-02-14T15:00:00Z',
      files: [
        { filename: '.env.production', status: 'modified', additions: 1, deletions: 1 },
      ],
    },
    {
      sha: 'ff03cccc',
      message: 'chore: update monitoring dashboards',
      author: 'ops@acme.com',
      date: '2026-02-14T16:00:00Z',
      files: [{ filename: 'infra/cloudformation.yml', status: 'modified', additions: 5, deletions: 0 }],
    },
    {
      sha: 'ff04dddd',
      message: 'ci: deploy v2.14.7 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-15T08:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    ff02bbbb: {
      sha: 'ff02bbbb',
      message: 'ops: enable batch processing in production for load test',
      files: [
        {
          filename: '.env.production',
          status: 'modified',
          patch: `@@ -5,4 +5,4 @@
 CACHE_ENABLED=true
-ENABLE_BATCH=false
+ENABLE_BATCH=true
+# BUG: batch mode enabled but not tested with production traffic patterns`,
        },
      ],
    },
    ff01aaaa: {
      sha: 'ff01aaaa',
      message: 'feat: implement batch payment processing mode',
      files: [
        {
          filename: 'src/services/payment.service.ts',
          status: 'modified',
          patch: `@@ -40,6 +40,30 @@
+  // Batch mode — processes payments in chunks without individual error handling
+  async processBatch(paymentIds: string[]): Promise<void> {
+    if (!config.featureFlags.enableBatchProcessing) {
+      throw new Error('Batch processing not enabled');
+    }
+    // BUG: no individual error handling — one failure crashes the entire batch
+    const payments = await Promise.all(
+      paymentIds.map(id => this.repo.findById(id))
+    );
+    for (const payment of payments) {
+      if (!payment) continue;
+      payment.status = 'processed';
+      await this.repo.save(payment);
+    }
+  }`,
        },
      ],
    },
  },

  files: {
    'src/services/payment.service.ts': {
      path: 'src/services/payment.service.ts',
      content: `import { v4 as uuid } from 'uuid';
import type { PaymentRepository } from '../repositories/payment.repository.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class PaymentService {
  constructor(private repo: PaymentRepository) {}

  async createPayment(data: { amount: number; currency: string }) {
    const payment = { id: uuid(), amount: data.amount, currency: data.currency, status: 'pending', createdAt: new Date().toISOString() };
    await this.repo.save(payment);
    return payment;
  }

  async processPayment(paymentId: string) {
    const payment = await this.repo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    payment.status = 'processed';
    await this.repo.save(payment);
    return payment;
  }

  // BUG: batch mode has no individual error handling or transaction safety
  // One failed payment causes entire batch to fail silently
  async processBatch(paymentIds: string[]): Promise<void> {
    if (!config.featureFlags.enableBatchProcessing) {
      throw new Error('Batch processing not enabled');
    }
    const payments = await Promise.all(
      paymentIds.map(id => this.repo.findById(id))
    );
    for (const payment of payments) {
      if (!payment) continue;
      payment.status = 'processed';
      await this.repo.save(payment);
      // No try/catch — if save fails here, remaining payments are skipped
    }
    logger.info({ count: paymentIds.length }, 'Batch processing completed');
  }
}`,
      size: 1050,
      sha: 'ff_file1',
    },
    '.env.production': {
      path: '.env.production',
      content: `PORT=3000
DB_HOST=prod-db.internal
REDIS_URL=redis://prod-redis.internal:6379
LOG_LEVEL=info
ENABLE_BATCH=true
CACHE_ENABLED=true
REQUEST_TIMEOUT_MS=30000`,
      size: 160,
      sha: 'ff_file2',
    },
    'src/config.ts': {
      path: 'src/config.ts',
      content: `export const config = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    pool: { min: 5, max: 20 },
    idleTimeoutMs: 30000,
  },
  redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
  featureFlags: {
    enableBatchProcessing: process.env.ENABLE_BATCH === 'true',
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  },
};`,
      size: 400,
      sha: 'ff_file3',
    },
  },

  deployments: [
    {
      id: 808,
      sha: 'ff04dddd',
      environment: 'production',
      createdAt: '2026-02-15T08:15:00Z',
      status: 'success',
    },
  ],
};
