import type { FixtureScenario } from './index.js';

export const dependencyUpgrade: FixtureScenario = {
  name: 'dependency-upgrade',
  description: 'Breaking change from pg v8→v9 upgrade without updating query patterns',

  commits: [
    {
      sha: 'du01aaaa',
      message: 'chore: update pg from v8 to v9',
      author: 'dependabot[bot]',
      date: '2026-02-14T08:00:00Z',
      files: [
        { filename: 'package.json', status: 'modified', additions: 1, deletions: 1 },
        { filename: 'package-lock.json', status: 'modified', additions: 50, deletions: 45 },
      ],
    },
    {
      sha: 'du02bbbb',
      message: 'test: fix type errors from pg upgrade',
      author: 'dev@acme.com',
      date: '2026-02-14T09:00:00Z',
      files: [{ filename: 'tests/payment.test.ts', status: 'modified', additions: 3, deletions: 3 }],
    },
    {
      sha: 'du03cccc',
      message: 'ci: deploy v2.15.0 to production',
      author: 'ci-bot@acme.com',
      date: '2026-02-15T08:00:00Z',
      files: [{ filename: 'infra/task-definition.json', status: 'modified', additions: 1, deletions: 1 }],
    },
  ],

  diffs: {
    du01aaaa: {
      sha: 'du01aaaa',
      message: 'chore: update pg from v8 to v9',
      files: [
        {
          filename: 'package.json',
          status: 'modified',
          patch: `@@ -8,7 +8,7 @@
   "dependencies": {
     "express": "^4.18.2",
-    "pg": "^8.11.3",
+    "pg": "^9.0.0",
     "ioredis": "^5.3.2",`,
        },
      ],
    },
  },

  files: {
    'package.json': {
      path: 'package.json',
      content: `{
  "name": "payment-service",
  "version": "2.15.0",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^9.0.0",
    "ioredis": "^5.3.2",
    "pino": "^8.16.0",
    "uuid": "^9.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.2",
    "@types/pg": "^8.10.9"
  }
}`,
      size: 320,
      sha: 'du_file1',
    },
    'src/repositories/payment.repository.ts': {
      path: 'src/repositories/payment.repository.ts',
      content: `import { Pool } from 'pg';
import { config } from '../config.js';

// pg v9 breaking change: Pool constructor options changed
// 'idleTimeoutMillis' renamed to 'idleTimeout' in v9
// Using old option name causes pool to never clean up idle connections
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  min: config.db.pool.min,
  max: config.db.pool.max,
  idleTimeoutMillis: config.db.idleTimeoutMs, // BUG: ignored in pg v9, should be idleTimeout
});

export class PaymentRepository {
  async save(payment: any): Promise<void> {
    const conn = await pool.connect();
    try {
      await conn.query(
        'INSERT INTO payments (id, amount, currency, status) VALUES ($1, $2, $3, $4)',
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
}`,
      size: 850,
      sha: 'du_file2',
    },
  },

  deployments: [
    {
      id: 707,
      sha: 'du03cccc',
      environment: 'production',
      createdAt: '2026-02-15T08:30:00Z',
      status: 'success',
    },
  ],
};
