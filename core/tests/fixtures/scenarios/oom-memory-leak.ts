import type { FixtureScenario } from './index.js';

export const oomMemoryLeak: FixtureScenario = {
  name: 'oom-memory-leak',
  description: 'Memory leak caused by unbounded cache Map in payment service handler',

  commits: [
    {
      sha: 'a1b2c3d4',
      message: 'chore: update dependencies',
      author: 'dependabot[bot]',
      date: '2026-02-15T10:00:00Z',
      files: [{ filename: 'package.json', status: 'modified', additions: 3, deletions: 3 }],
    },
    {
      sha: 'e5f6g7h8',
      message: 'feat: add payment result caching for faster lookups',
      author: 'dev@acme.com',
      date: '2026-02-16T14:30:00Z',
      files: [
        { filename: 'src/services/payment.service.ts', status: 'modified', additions: 12, deletions: 2 },
        { filename: 'src/repositories/cache.repository.ts', status: 'modified', additions: 5, deletions: 0 },
      ],
    },
    {
      sha: 'i9j0k1l2',
      message: 'fix: correct currency format for BRL',
      author: 'dev@acme.com',
      date: '2026-02-16T16:00:00Z',
      files: [{ filename: 'src/services/payment.service.ts', status: 'modified', additions: 1, deletions: 1 }],
    },
    {
      sha: 'm3n4o5p6',
      message: 'ci: deploy v2.14.1 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-17T08:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    e5f6g7h8: {
      sha: 'e5f6g7h8',
      message: 'feat: add payment result caching for faster lookups',
      files: [
        {
          filename: 'src/services/payment.service.ts',
          status: 'modified',
          patch: `@@ -1,6 +1,8 @@
 import { v4 as uuid } from 'uuid';
 import type { PaymentRepository } from '../repositories/payment.repository.js';
+import { NotificationService } from './notification.service.js';
 import { logger } from '../utils/logger.js';
+
+// In-memory cache for processed payment results
+const paymentCache = new Map<string, any>();

 export class PaymentService {
@@ -20,6 +22,10 @@ export class PaymentService {
   async getPayment(id: string): Promise<Payment | null> {
+    // Check cache first for faster response
+    const cached = paymentCache.get(id);
+    if (cached) return cached;
     const payment = await this.repo.findById(id);
+    if (payment) paymentCache.set(id, payment);
     return payment;
   }`,
        },
      ],
    },
    i9j0k1l2: {
      sha: 'i9j0k1l2',
      message: 'fix: correct currency format for BRL',
      files: [
        {
          filename: 'src/services/payment.service.ts',
          status: 'modified',
          patch: `@@ -15,7 +15,7 @@
     const payment: Payment = {
       id: uuid(),
       amount: data.amount,
-      currency: data.currency,
+      currency: data.currency.toUpperCase(),
       status: 'pending',`,
        },
      ],
    },
  },

  files: {
    'src/services/payment.service.ts': {
      path: 'src/services/payment.service.ts',
      content: `import { v4 as uuid } from 'uuid';
import type { PaymentRepository } from '../repositories/payment.repository.js';
import { NotificationService } from './notification.service.js';
import { logger } from '../utils/logger.js';

// BUG: In-memory cache with no eviction — grows unbounded causing OOM
const paymentCache = new Map<string, any>();

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export class PaymentService {
  private notifier = new NotificationService();

  constructor(private repo: PaymentRepository) {}

  async createPayment(data: { amount: number; currency: string }): Promise<Payment> {
    const payment: Payment = {
      id: uuid(),
      amount: data.amount,
      currency: data.currency.toUpperCase(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await this.repo.save(payment);
    // Cache new payment — never evicted
    paymentCache.set(payment.id, payment);
    return payment;
  }

  async getPayment(id: string): Promise<Payment | null> {
    const cached = paymentCache.get(id);
    if (cached) return cached;
    const payment = await this.repo.findById(id);
    if (payment) paymentCache.set(id, payment);
    return payment;
  }

  async processPayment(paymentId: string): Promise<Payment> {
    const payment = await this.repo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    payment.status = 'processed';
    await this.repo.save(payment);
    paymentCache.set(paymentId, payment);
    await this.notifier.sendReceipt(payment.id);
    return payment;
  }

  async refundPayment(id: string): Promise<Payment> {
    const payment = await this.repo.findById(id);
    if (!payment) throw new Error('Payment not found');
    payment.status = 'refunded';
    await this.repo.save(payment);
    paymentCache.set(id, payment);
    logger.info({ paymentId: id }, 'Payment refunded');
    return payment;
  }
}`,
      size: 1250,
      sha: 'abc123',
    },
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
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
  featureFlags: {
    enableBatchProcessing: process.env.ENABLE_BATCH === 'true',
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  },
};`,
      size: 480,
      sha: 'def456',
    },
    'Dockerfile': {
      path: 'Dockerfile',
      content: `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]`,
      size: 210,
      sha: 'ghi789',
    },
  },

  deployments: [
    {
      id: 101,
      sha: 'm3n4o5p6',
      environment: 'production',
      createdAt: '2026-02-17T08:15:00Z',
      status: 'success',
    },
    {
      id: 100,
      sha: 'a1b2c3d4',
      environment: 'staging',
      createdAt: '2026-02-15T11:00:00Z',
      status: 'success',
    },
  ],
};
