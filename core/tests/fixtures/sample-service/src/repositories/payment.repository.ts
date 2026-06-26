/* eslint-disable */
import { Pool } from 'pg';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

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
  async save(payment: Payment): Promise<void> {
    const conn = await pool.connect();
    try {
      await conn.query(
        'INSERT INTO payments (id, amount, currency, status, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET status = $4',
        [payment.id, payment.amount, payment.currency, payment.status, payment.createdAt],
      );
    } finally {
      conn.release();
    }
  }

  async findById(id: string): Promise<Payment | null> {
    const conn = await pool.connect();
    try {
      const result = await conn.query('SELECT * FROM payments WHERE id = $1', [id]);
      return result.rows[0] ?? null;
    } finally {
      conn.release();
    }
  }

  async findByStatus(status: string, limit = 50): Promise<Payment[]> {
    const conn = await pool.connect();
    try {
      const result = await conn.query('SELECT * FROM payments WHERE status = $1 ORDER BY created_at DESC LIMIT $2', [status, limit]);
      return result.rows;
    } finally {
      conn.release();
    }
  }

  async healthCheck(): Promise<void> {
    const conn = await pool.connect();
    try {
      await conn.query('SELECT 1');
    } finally {
      conn.release();
    }
  }
}
