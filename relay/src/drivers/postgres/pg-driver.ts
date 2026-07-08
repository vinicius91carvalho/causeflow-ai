import pg from 'pg';
import type { IReadOnlyDriver, DriverCommand, DriverResult } from '../driver.port.js';
import { validateQuery } from './pg-query-parser.js';
import pino from 'pino';

const logger = pino({ name: 'pg-driver' });
const { Pool } = pg;

// PostgreSQL OID to type name mapping for common types.
// See https://www.postgresql.org/docs/16/catalog-pg-type.html
const OID_MAP: Record<number, string> = {
  16: 'bool',
  17: 'bytea',
  18: 'char',
  19: 'name',
  20: 'int8',
  21: 'int2',
  22: 'int2vector',
  23: 'int4',
  24: 'regproc',
  25: 'text',
  26: 'oid',
  27: 'tid',
  28: 'xid',
  29: 'cid',
  114: 'json',
  142: 'xml',
  143: '_xml',
  194: 'pg_node_tree',
  600: 'point',
  601: 'lseg',
  602: 'path',
  603: 'box',
  604: 'polygon',
  628: 'line',
  650: 'cidr',
  700: 'float4',
  701: 'float8',
  702: 'abstime',
  703: 'reltime',
  704: 'tinterval',
  705: 'unknown',
  718: 'circle',
  790: 'money',
  829: 'macaddr',
  869: 'inet',
  1000: '_bool',
  1001: '_bytea',
  1002: '_char',
  1003: '_name',
  1005: '_int2',
  1007: '_int4',
  1009: '_text',
  1014: '_bpchar',
  1015: '_varchar',
  1016: '_int8',
  1028: '_oid',
  1042: 'bpchar',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1266: 'timetz',
  1560: 'bit',
  1562: 'varbit',
  1700: 'numeric',
  2202: 'regprocedure',
  2203: 'regoper',
  2204: 'regoperator',
  2205: 'regclass',
  2206: 'regtype',
  2950: 'uuid',
  2970: 'txid_snapshot',
  3220: 'pg_lsn',
  3361: 'pg_ndistinct',
  3402: 'pg_dependencies',
  3614: 'tsvector',
  3615: 'tsquery',
  3642: 'gtsvector',
  3734: 'regconfig',
  3769: 'regdictionary',
  3802: 'jsonb',
  3904: 'int4range',
  3906: 'numrange',
  3908: 'tsrange',
  3910: 'tstzrange',
  3912: 'daterange',
  3926: 'int8range',
  4072: 'jsonpath',
  4480: 'regnamespace',
  4481: 'regproc',
  4600: 'pg_brin_bloom_summary',
  4601: 'pg_brin_minmax_multi_summary',
  5000: 'xid8',
  5036: 'pg_snapshot',
  5038: 'pg_mcv_list',
};

function oidToType(oid: number | undefined): string {
  if (oid === undefined) return 'unknown';
  return OID_MAP[oid] ?? `oid(${oid})`;
}


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
            fields: result.fields?.map((f) => ({ name: f.name, type: oidToType(f.dataTypeID) })),
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
