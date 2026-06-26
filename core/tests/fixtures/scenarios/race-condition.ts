import type { FixtureScenario } from './index.js';

export const raceCondition: FixtureScenario = {
  name: 'race-condition',
  description: 'Race condition caused by removing mutex/lock from concurrent payment processing',

  commits: [
    {
      sha: 'rc01aaaa',
      message: 'perf: remove synchronization lock to improve throughput',
      author: 'senior-dev@acme.com',
      date: '2026-02-14T13:00:00Z',
      files: [{ filename: 'src/services/payment.service.ts', status: 'modified', additions: 3, deletions: 10 }],
    },
    {
      sha: 'rc02bbbb',
      message: 'docs: update payment processing docs',
      author: 'dev@acme.com',
      date: '2026-02-14T14:00:00Z',
      files: [{ filename: 'README.md', status: 'modified', additions: 5, deletions: 2 }],
    },
    {
      sha: 'rc03cccc',
      message: 'ci: deploy v2.14.5 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-15T09:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    rc01aaaa: {
      sha: 'rc01aaaa',
      message: 'perf: remove synchronization lock to improve throughput',
      files: [
        {
          filename: 'src/services/payment.service.ts',
          status: 'modified',
          patch: `@@ -15,18 +15,11 @@
-const processingLock = new Map<string, boolean>();
-
 export class PaymentService {
   async processPayment(paymentId: string): Promise<Payment> {
-    if (processingLock.has(paymentId)) {
-      throw new Error('Payment already being processed');
-    }
-    processingLock.set(paymentId, true);
-    try {
-      const payment = await this.repo.findById(paymentId);
-      // ... processing logic
-    } finally {
-      processingLock.delete(paymentId);
-    }
+    // Lock removed for performance — concurrent calls can now double-charge
+    const payment = await this.repo.findById(paymentId);
+    if (!payment) throw new Error('Payment not found');
+    payment.status = 'processed';
+    await this.repo.save(payment);
+    return payment;
   }`,
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

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

// BUG: processingLock was removed — concurrent requests can double-charge
export class PaymentService {
  private notifier = new NotificationService();
  constructor(private repo: PaymentRepository) {}

  async createPayment(data: { amount: number; currency: string }): Promise<Payment> {
    const payment: Payment = {
      id: uuid(), amount: data.amount, currency: data.currency,
      status: 'pending', createdAt: new Date().toISOString(),
    };
    await this.repo.save(payment);
    return payment;
  }

  async processPayment(paymentId: string): Promise<Payment> {
    // No lock — race condition: two concurrent calls can both read 'pending' and charge twice
    const payment = await this.repo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'pending') throw new Error('Already processed');
    payment.status = 'processed';
    await this.repo.save(payment);
    await this.notifier.sendReceipt(payment.id);
    return payment;
  }

  async getPayment(id: string): Promise<Payment | null> {
    return this.repo.findById(id);
  }
}`,
      size: 950,
      sha: 'rc_file1',
    },
  },

  deployments: [
    {
      id: 505,
      sha: 'rc03cccc',
      environment: 'production',
      createdAt: '2026-02-15T09:15:00Z',
      status: 'success',
    },
  ],
};
