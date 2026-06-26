import pg from 'pg';
import type { IReadOnlyDriver, DriverCommand, DriverResult } from '../driver.port.js';
import { validateQuery } from './pg-query-parser.js';
import pino from 'pino';

const logger = pino({ name: 'pg-driver' });
const { Pool } = pg;

export interface PgDriverConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxRows?: number;
}

export class PgDriver implements IReadOnlyDriver {
  readonly type = 'postgres' as const;
  private pool: pg.Pool;
  private maxRows: number;

  constructor(config: PgDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  validate(command: DriverCommand): { valid: boolean; reason?: string } {
    if (command.operation === 'query' || command.operation === 'explain') {
      const sql = command.params['sql'] as string;
      if (!sql) return { valid: false, reason: 'Missing sql parameter' };
      return validateQuery(sql);
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();

    switch (command.operation) {
      case 'list_tables': {
        const result = await this.pool.query(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
          fields: [{ name: 'table_name', type: 'text' }, { name: 'table_type', type: 'text' }],
          executionTimeMs: Date.now() - start,
        };
      }

      case 'describe_table': {
        const tableName = command.params['tableName'] as string;
        if (!tableName) throw new Error('Missing tableName parameter');

        const result = await this.pool.query(`
          SELECT column_name, data_type, is_nullable, column_default,
                 character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);

        // Also get constraints
        const constraints = await this.pool.query(`
          SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.table_name = $1
        `, [tableName]);

        return {
          rows: [...result.rows, ...constraints.rows.map((c: Record<string, unknown>) => ({ ...c, _type: 'constraint' }))],
          rowCount: (result.rowCount ?? 0) + (constraints.rowCount ?? 0),
          executionTimeMs: Date.now() - start,
        };
      }

      case 'query': {
        const sql = command.params['sql'] as string;
        const limit = Math.min(
          (command.params['limit'] as number) ?? this.maxRows,
          this.maxRows,
        );

        // Wrap in a read-only transaction
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN READ ONLY');
          await client.query(`SET statement_timeout = '30s'`);
          const result = await client.query(`${sql} LIMIT ${limit}`);
          await client.query('COMMIT');

          return {
            rows: result.rows,
            rowCount: result.rowCount ?? 0,
            fields: result.fields?.map((f) => ({ name: f.name, type: f.dataTypeID?.toString() ?? 'unknown' })),
            executionTimeMs: Date.now() - start,
          };
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      }

      case 'explain': {
        const sql = command.params['sql'] as string;
        const result = await this.pool.query(`EXPLAIN ANALYZE ${sql}`);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
          executionTimeMs: Date.now() - start,
        };
      }

      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'describe_table', 'list_tables', 'explain'];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
