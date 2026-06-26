import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';
import { validateQuery as validatePgLikeQuery } from '../postgres/pg-query-parser.js';
import pino from 'pino';

const logger = pino({ name: 'mysql-driver' });

interface MySqlPool {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<[T, unknown]>;
  end(): Promise<void>;
  getConnection(): Promise<{
    query<T = unknown>(sql: string, params?: unknown[]): Promise<[T, unknown]>;
    release(): void;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }>;
}

export interface MysqlDriverConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: Record<string, unknown>;
  maxRows?: number;
  statementTimeoutMs?: number;
}

export class MysqlDriver implements IReadOnlyDriver {
  readonly type = 'mysql' as const;
  private poolPromise: Promise<MySqlPool>;
  private maxRows: number;
  private statementTimeoutMs: number;

  constructor(config: MysqlDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
    this.statementTimeoutMs = config.statementTimeoutMs ?? 30_000;
    this.poolPromise = (async () => {
      const mod = await import('mysql2/promise');
      const { createPool } = mod as unknown as {
        createPool: (opts: Record<string, unknown>) => MySqlPool;
      };
      return createPool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        connectionLimit: 5,
        connectTimeout: 10_000,
        waitForConnections: true,
        enableKeepAlive: true,
      });
    })();
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query' || command.operation === 'explain') {
      const sql = command.params['sql'];
      if (typeof sql !== 'string' || !sql.trim()) return { valid: false, reason: 'Missing sql' };
      const result = validatePgLikeQuery(sql);
      return { valid: result.valid, reason: result.reason };
    }
    if (command.operation === 'describe_table') {
      const tableName = command.params['tableName'];
      if (typeof tableName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
        return { valid: false, reason: 'Invalid tableName' };
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
    const pool = await this.poolPromise;
    const [rows] = await pool.query<Record<string, unknown>[]>('SHOW TABLES');
    return {
      rows: rows.map((r) => ({ table_name: Object.values(r)[0] })),
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  private async describeTable(command: DriverCommand, start: number): Promise<DriverResult> {
    const pool = await this.poolPromise;
    const tableName = command.params['tableName'] as string;
    const [columns] = await pool.query<Record<string, unknown>[]>(`DESCRIBE \`${tableName}\``);
    const [indexes] = await pool.query<Record<string, unknown>[]>(`SHOW INDEXES FROM \`${tableName}\``);
    return {
      rows: [
        ...columns.map((c) => ({ ...c, _type: 'column' })),
        ...indexes.map((i) => ({ ...i, _type: 'index' })),
      ],
      rowCount: columns.length + indexes.length,
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
    const pool = await this.poolPromise;
    const sql = command.params['sql'] as string;
    const limit = this.resolveLimit(command.params);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`SET SESSION MAX_EXECUTION_TIME = ${Number(this.statementTimeoutMs)}`);
      const wrapped = `SELECT * FROM (${sql}) AS __relay_subquery LIMIT ?`;
      const [rows] = await conn.query<Record<string, unknown>[]>(wrapped, [limit]);
      await conn.commit();
      return {
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - start,
      };
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  }

  private async explain(command: DriverCommand, start: number): Promise<DriverResult> {
    const pool = await this.poolPromise;
    const sql = command.params['sql'] as string;
    const [rows] = await pool.query<Record<string, unknown>[]>(`EXPLAIN FORMAT=JSON ${sql}`);
    return {
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const pool = await this.poolPromise;
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'describe_table', 'list_tables', 'explain'];
  }

  async close(): Promise<void> {
    const pool = await this.poolPromise;
    await pool.end();
  }
}

export const mysqlDriverFactory: DriverFactory = {
  type: 'mysql',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    return new MysqlDriver({
      host: secrets['host'] ?? conn['host'] ?? 'localhost',
      port: Number(secrets['port'] ?? conn['port'] ?? 3306),
      database: secrets['database'] ?? conn['database'] ?? '',
      user: secrets['user'] ?? conn['user'] ?? '',
      password: secrets['password'] ?? conn['password'] ?? '',
      maxRows: resource.maxRowsPerQuery,
      statementTimeoutMs: resource.statementTimeoutMs,
    });
  },
};
