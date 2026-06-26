import type { FixtureScenario } from './index.js';

export const connectionPoolExhaustion: FixtureScenario = {
  name: 'connection-pool-exhaustion',
  description: 'Database connection pool leak caused by missing connection.release() in finally block',

  commits: [
    {
      sha: 'cp01aaaa',
      message: 'feat: add batch payment status query',
      author: 'dev@acme.com',
      date: '2026-02-14T09:00:00Z',
      files: [{ filename: 'src/repositories/payment.repository.ts', status: 'modified', additions: 15, deletions: 0 }],
    },
    {
      sha: 'cp02bbbb',
      message: 'refactor: simplify error handling in repository layer',
      author: 'senior-dev@acme.com',
      date: '2026-02-15T11:00:00Z',
      files: [
        { filename: 'src/repositories/payment.repository.ts', status: 'modified', additions: 8, deletions: 14 },
      ],
    },
    {
      sha: 'cp03cccc',
      message: 'test: add integration tests for payment repo',
      author: 'dev@acme.com',
      date: '2026-02-15T14:00:00Z',
      files: [{ filename: 'tests/payment.test.ts', status: 'modified', additions: 25, deletions: 0 }],
    },
    {
      sha: 'cp04dddd',
      message: 'ci: deploy v2.14.2 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-16T08:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    cp02bbbb: {
      sha: 'cp02bbbb',
      message: 'refactor: simplify error handling in repository layer',
      files: [
        {
          filename: 'src/repositories/payment.repository.ts',
          status: 'modified',
          patch: `@@ -28,14 +28,10 @@ export class PaymentRepository {
   async findById(id: string): Promise<Payment | null> {
     const conn = await pool.connect();
-    try {
-      const result = await conn.query('SELECT * FROM payments WHERE id = $1', [id]);
-      return result.rows[0] ?? null;
-    } finally {
-      conn.release();
-    }
+    const result = await conn.query('SELECT * FROM payments WHERE id = $1', [id]);
+    return result.rows[0] ?? null;
+    // BUG: connection.release() removed during refactor — pool will exhaust
   }

   async findByStatus(status: string, limit = 50): Promise<Payment[]> {
     const conn = await pool.connect();
-    try {
-      const result = await conn.query('SELECT * FROM payments WHERE status = $1 LIMIT $2', [status, limit]);
-      return result.rows;
-    } finally {
-      conn.release();
-    }
+    const result = await conn.query('SELECT * FROM payments WHERE status = $1 LIMIT $2', [status, limit]);
+    return result.rows;
   }`,
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
    // BUG: missing try/finally with conn.release()
    const result = await conn.query('SELECT * FROM payments WHERE id = $1', [id]);
    return result.rows[0] ?? null;
    // connection leaked here
  }

  async findByStatus(status: string, limit = 50): Promise<any[]> {
    const conn = await pool.connect();
    // BUG: same issue — no release
    const result = await conn.query('SELECT * FROM payments WHERE status = $1 LIMIT $2', [status, limit]);
    return result.rows;
  }

  async healthCheck(): Promise<void> {
    const conn = await pool.connect();
    try {
      await conn.query('SELECT 1');
    } finally {
      conn.release();
    }
  }
}`,
      size: 980,
      sha: 'cp_file1',
    },
  },

  deployments: [
    {
      id: 202,
      sha: 'cp04dddd',
      environment: 'production',
      createdAt: '2026-02-16T08:30:00Z',
      status: 'success',
    },
  ],
};
