import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const mysqlListTables = defineToolSpec({
    name: 'mysql_list_tables',
    driverType: 'mysql',
    operation: 'list_tables',
    description: 'List tables in a MySQL/MariaDB resource.',
    inputSchema: z.object({ resourceId: z.string() }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 10_000,
});

const mysqlDescribeTable = defineToolSpec({
    name: 'mysql_describe_table',
    driverType: 'mysql',
    operation: 'describe_table',
    description: 'Describe a MySQL table: columns (DESCRIBE) and indexes (SHOW INDEXES).',
    inputSchema: z.object({ resourceId: z.string(), tableName: z.string() }),
    buildCommand: ({ resourceId, tableName }) => ({ resourceId, operation: 'describe_table', params: { tableName } }),
    maxResultChars: 15_000,
});

const mysqlQuery = defineToolSpec({
    name: 'mysql_query',
    driverType: 'mysql',
    operation: 'query',
    description: 'Run a read-only SELECT against a MySQL/MariaDB resource. AST-validated, SELECT only, LIMIT parameterized, MAX_EXECUTION_TIME enforced. PII masked automatically.',
    inputSchema: z.object({
        resourceId: z.string(),
        sql: z.string().describe('Single SELECT'),
        limit: z.number().int().positive().max(1000).default(100),
    }),
    buildCommand: ({ resourceId, sql, limit }) => ({ resourceId, operation: 'query', params: { sql, limit } }),
    maxResultChars: 30_000,
});

const mysqlExplain = defineToolSpec({
    name: 'mysql_explain',
    driverType: 'mysql',
    operation: 'explain',
    description: 'EXPLAIN FORMAT=JSON on a MySQL query — execution plan, index hits, costs.',
    inputSchema: z.object({ resourceId: z.string(), sql: z.string() }),
    buildCommand: ({ resourceId, sql }) => ({ resourceId, operation: 'explain', params: { sql } }),
    maxResultChars: 15_000,
});

export const MYSQL_TOOLS = [mysqlListTables, mysqlDescribeTable, mysqlQuery, mysqlExplain] as unknown as readonly AnyToolSpec[];
