import pg from 'pg';
import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';
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
  ssl?: pg.PoolConfig['ssl'];
  maxRows?: number;
  statementTimeoutMs?: number;
  schema?: string;
}

const MAX_ABSOLUTE_LIMIT = 100_000;

export class PgDriver implements IReadOnlyDriver {
  readonly type = 'postgres' as const;
  private pool: pg.Pool;
  private maxRows: number;
  private statementTimeoutMs: number;
  private schema: string;

  constructor(config: PgDriverConfig) {
    this.maxRows = Math.min(config.maxRows ?? 1000, MAX_ABSOLUTE_LIMIT);
    this.statementTimeoutMs = config.statementTimeoutMs ?? 30_000;
    this.schema = config.schema ?? 'public';
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: 'causeflow-relay',
    });

    this.pool.on('error', (err) => {
      logger.error({ err }, 'Pool idle client error');
    });
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query' || command.operation === 'explain') {
      const sql = command.params['sql'];
      if (typeof sql !== 'string' || !sql.trim()) {
        return { valid: false, reason: 'Missing sql parameter' };
      }
      const result = validateQuery(sql);
      return { valid: result.valid, reason: result.reason };
    }
    if (command.operation === 'describe_table') {
      const tableName = command.params['tableName'];
      if (typeof tableName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
        return { valid: false, reason: 'Invalid tableName (identifier required)' };
      }
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();

    switch (command.operation) {
      case 'list_tables':
        return this.listTables(start);
      case 'describe_table':
        return this.describeTable(command, start);
      case 'query':
        return this.runQuery(command, start);
      case 'explain':
        return this.explain(command, start);
      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  private async listTables(start: number): Promise<DriverResult> {
    const result = await this.pool.query(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_name`,
      [this.schema],
    );
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      fields: [
        { name: 'table_name', type: 'text' },
        { name: 'table_type', type: 'text' },
      ],
      executionTimeMs: Date.now() - start,
    };
  }

  private async describeTable(command: DriverCommand, start: number): Promise<DriverResult> {
    const tableName = command.params['tableName'] as string;

    const [columns, constraints, indexes] = await Promise.all([
      this.pool.query(
        `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [this.schema, tableName],
      ),
      this.pool.query(
        `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = $1 AND tc.table_name = $2`,
        [this.schema, tableName],
      ),
      this.pool.query(
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE schemaname = $1 AND tablename = $2`,
        [this.schema, tableName],
      ),
    ]);

    const rows = [
      ...columns.rows,
      ...constraints.rows.map((c: Record<string, unknown>) => ({ ...c, _type: 'constraint' })),
      ...indexes.rows.map((i: Record<string, unknown>) => ({ ...i, _type: 'index' })),
    ];

    return {
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  private resolveLimit(params: Record<string, unknown>): number {
    const raw = params['limit'];
    const parsed = typeof raw === 'number' ? Math.floor(raw) : Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return this.maxRows;
    return Math.min(parsed, this.maxRows);
  }

  private async runQuery(command: DriverCommand, start: number): Promise<DriverResult> {
    const sql = command.params['sql'] as string;
    const limit = this.resolveLimit(command.params);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SET LOCAL statement_timeout = ${Number(this.statementTimeoutMs)}`);
      const wrapped = `SELECT * FROM (${sql}) AS __relay_subquery LIMIT $1::bigint`;
      const result = await client.query(wrapped, [limit]);
      await client.query('COMMIT');

      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
        fields: result.fields?.map((f) => ({
          name: f.name,
          type: f.dataTypeID?.toString() ?? 'unknown',
        })),
        executionTimeMs: Date.now() - start,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* ignore */ });
      throw err;
    } finally {
      client.release();
    }
  }

  private async explain(command: DriverCommand, start: number): Promise<DriverResult> {
    const sql = command.params['sql'] as string;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SET LOCAL statement_timeout = ${Number(this.statementTimeoutMs)}`);
      const result = await client.query(`EXPLAIN (ANALYZE false, FORMAT JSON) ${sql}`);
      await client.query('COMMIT');
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
        executionTimeMs: Date.now() - start,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* ignore */ });
      throw err;
    } finally {
      client.release();
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

export const pgDriverFactory: DriverFactory = {
  type: 'postgres',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    return new PgDriver({
      host: secrets['host'] ?? conn['host'] ?? 'localhost',
      port: Number(secrets['port'] ?? conn['port'] ?? 5432),
      database: secrets['database'] ?? conn['database'] ?? '',
      user: secrets['user'] ?? conn['user'] ?? '',
      password: secrets['password'] ?? conn['password'] ?? '',
      ssl: (conn['ssl'] as unknown) === 'true' || (conn['ssl'] as unknown) === true
        ? { rejectUnauthorized: true }
        : undefined,
      maxRows: resource.maxRowsPerQuery,
      statementTimeoutMs: resource.statementTimeoutMs,
      schema: resource.schema ?? 'public',
    });
  },
};
