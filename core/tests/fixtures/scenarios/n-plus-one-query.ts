import type { FixtureScenario } from './index.js';

export const nPlusOneQuery: FixtureScenario = {
  name: 'n-plus-one-query',
  description: 'N+1 query caused by loop of individual SELECTs instead of batch query',

  commits: [
    {
      sha: 'nq01aaaa',
      message: 'feat: add order details to payment list endpoint',
      author: 'dev@acme.com',
      date: '2026-02-14T10:00:00Z',
      files: [
        { filename: 'src/repositories/payment.repository.ts', status: 'modified', additions: 18, deletions: 2 },
        { filename: 'src/routes/payments.ts', status: 'modified', additions: 5, deletions: 1 },
      ],
    },
    {
      sha: 'nq02bbbb',
      message: 'style: format code with prettier',
      author: 'dev@acme.com',
      date: '2026-02-14T10:30:00Z',
      files: [
        { filename: 'src/repositories/payment.repository.ts', status: 'modified', additions: 2, deletions: 2 },
      ],
    },
    {
      sha: 'nq03cccc',
      message: 'ci: deploy v2.14.3 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-15T09:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    nq01aaaa: {
      sha: 'nq01aaaa',
      message: 'feat: add order details to payment list endpoint',
      files: [
        {
          filename: 'src/repositories/payment.repository.ts',
          status: 'modified',
          patch: `@@ -45,6 +45,22 @@ export class PaymentRepository {
+  // Fetch order details for each payment
+  async findPaymentsWithOrders(status: string, limit = 50): Promise<any[]> {
+    const conn = await pool.connect();
+    try {
+      const payments = await conn.query('SELECT * FROM payments WHERE status = $1 LIMIT $2', [status, limit]);
+      const results = [];
+      // BUG: N+1 query — individual SELECT for each payment's order
+      for (const payment of payments.rows) {
+        const order = await conn.query('SELECT * FROM orders WHERE payment_id = $1', [payment.id]);
+        results.push({ ...payment, order: order.rows[0] });
+      }
+      return results;
+    } finally {
+      conn.release();
+    }
+  }`,
        },
        {
          filename: 'src/routes/payments.ts',
          status: 'modified',
          patch: `@@ -25,6 +25,10 @@
+router.get('/with-orders', async (req, res) => {
+  const payments = await repo.findPaymentsWithOrders(req.query.status ?? 'processed');
+  res.json(payments);
+});`,
        },
      ],
    },
  },

  files: {
    'src/repositories/payment.repository.ts': {
      path: 'src/repositories/payment.repository.ts',
      content: `import { Pool } from 'pg';
import { config } from '../config.js';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  min: config.db.pool.min,
  max: config.db.pool.max,
  idleTimeoutMillis: config.db.idleTimeoutMs,
});

export class PaymentRepository {
  async save(payment: any): Promise<void> {
    const conn = await pool.connect();
    try {
      await conn.query(
        'INSERT INTO payments (id, amount, currency, status) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET status = $4',
        [payment.id, payment.amount, payment.currency, payment.status],
      );
    } finally {
      conn.release();
    }
  }

  async findById(id: string): Promise<any | null> {
    const conn = await pool.connect();
    try {
      const result = await conn.query('SELECT * FROM payments WHERE id = $1', [id]);
      return result.rows[0] ?? null;
    } finally {
      conn.release();
    }
  }

  // BUG: N+1 query — loops individual SELECTs instead of JOIN
  async findPaymentsWithOrders(status: string, limit = 50): Promise<any[]> {
    const conn = await pool.connect();
    try {
      const payments = await conn.query('SELECT * FROM payments WHERE status = $1 LIMIT $2', [status, limit]);
      const results = [];
      for (const payment of payments.rows) {
        const order = await conn.query('SELECT * FROM orders WHERE payment_id = $1', [payment.id]);
        results.push({ ...payment, order: order.rows[0] });
      }
      return results;
    } finally {
      conn.release();
    }
  }

  async healthCheck(): Promise<void> {
    const conn = await pool.connect();
    try { await conn.query('SELECT 1'); }
    finally { conn.release(); }
  }
}`,
      size: 1100,
      sha: 'nq_file1',
    },
    'src/routes/payments.ts': {
      path: 'src/routes/payments.ts',
      content: `import { Router } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { PaymentRepository } from '../repositories/payment.repository.js';

const router = Router();
const repo = new PaymentRepository();
const service = new PaymentService(repo);

router.post('/', async (req, res) => {
  const payment = await service.createPayment(req.body);
  res.status(201).json(payment);
});

router.get('/with-orders', async (req, res) => {
  const payments = await repo.findPaymentsWithOrders(String(req.query.status ?? 'processed'));
  res.json(payments);
});

router.get('/:id', async (req, res) => {
  const payment = await service.getPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Not found' });
  res.json(payment);
});

export { router as paymentRoutes };`,
      size: 650,
      sha: 'nq_file2',
    },
  },

  deployments: [
    {
      id: 303,
      sha: 'nq03cccc',
      environment: 'production',
      createdAt: '2026-02-15T09:30:00Z',
      status: 'success',
    },
  ],
};
