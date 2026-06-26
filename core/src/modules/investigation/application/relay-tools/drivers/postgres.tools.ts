import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const pgListTables = defineToolSpec({
    name: 'postgres_list_tables',
    driverType: 'postgres',
    operation: 'list_tables',
    description: 'List tables in a Postgres resource. Use this before querying to discover the schema. Use postgres_describe_table next for columns/indexes.',
    inputSchema: z.object({
        resourceId: z.string().describe('Resource id from list_relay_resources (must be type=postgres)'),
    }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 10_000,
});

const pgDescribeTable = defineToolSpec({
    name: 'postgres_describe_table',
    driverType: 'postgres',
    operation: 'describe_table',
    description: 'Describe a Postgres table: columns (name, type, nullable, default), primary/foreign keys, and indexes. Always run this before writing non-trivial queries.',
    inputSchema: z.object({
        resourceId: z.string(),
        tableName: z.string().describe('Table identifier. Must be a valid SQL identifier.'),
    }),
    buildCommand: ({ resourceId, tableName }) => ({ resourceId, operation: 'describe_table', params: { tableName } }),
    maxResultChars: 15_000,
});

const pgQuery = defineToolSpec({
    name: 'postgres_query',
    driverType: 'postgres',
    operation: 'query',
    description: `Run a read-only SELECT against a Postgres resource. SQL is parsed to AST server-side; only SELECT is allowed and the LIMIT is parameterized and clamped per-resource. Results are PII-masked automatically before leaving the customer network.

Examples:
- Detect stale rows: "SELECT id, updated_at FROM orders WHERE status='pending' AND updated_at < now() - interval '1h' ORDER BY updated_at"
- Count nulls: "SELECT COUNT(*) FROM users WHERE email IS NULL"
Use ORDER BY to see the most recent events first when diagnosing incidents.`,
    inputSchema: z.object({
        resourceId: z.string(),
        sql: z.string().describe('Single SELECT statement. Multi-statement and DDL/DML are rejected.'),
        limit: z.number().int().positive().max(1000).default(100).describe('Row limit (default 100, max 1000)'),
    }),
    buildCommand: ({ resourceId, sql, limit }) => ({
        resourceId,
        operation: 'query',
        params: { sql, limit },
    }),
    maxResultChars: 30_000,
});

const pgExplain = defineToolSpec({
    name: 'postgres_explain',
    driverType: 'postgres',
    operation: 'explain',
    description: 'Run EXPLAIN (FORMAT JSON) on a query to inspect the execution plan. Use this to diagnose slow queries (missing indexes, sequential scans on large tables).',
    inputSchema: z.object({
        resourceId: z.string(),
        sql: z.string().describe('SELECT statement to explain'),
    }),
    buildCommand: ({ resourceId, sql }) => ({
        resourceId,
        operation: 'explain',
        params: { sql },
    }),
    maxResultChars: 15_000,
});

export const POSTGRES_TOOLS = [pgListTables, pgDescribeTable, pgQuery, pgExplain] as unknown as readonly AnyToolSpec[];
