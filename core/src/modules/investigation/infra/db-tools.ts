/**
 * @deprecated Use `application/relay-tools/` registry instead. This file
 * predates the unified driver tool registry and only supports Postgres +
 * MongoDB. New code should import from `application/relay-tools/index.js`
 * and use `DEFAULT_RELAY_TOOL_REGISTRY`.
 *
 * Kept for backward compatibility with the legacy `db_analyst` sub-agent
 * config, which is no longer wired into AGENT_CONFIG_MAP.
 */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { IRelayGateway } from '../../../shared/application/ports/relay-gateway.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface DbToolDeps {
    relayGateway: IRelayGateway;
    tenantId: TenantId;
}

// --- Zod Schemas ---
export const dbListResourcesInputSchema = z.object({});
export const dbListTablesInputSchema = z.object({
    resourceId: z.string().describe('Database resource identifier (from db_list_resources)'),
});
export const dbDescribeTableInputSchema = z.object({
    resourceId: z.string().describe('Database resource identifier'),
    tableName: z.string().describe('Table name to describe (columns, types, constraints)'),
});
export const dbQueryInputSchema = z.object({
    resourceId: z.string().describe('Database resource identifier'),
    sql: z.string().describe('Read-only SQL query (SELECT only). For MongoDB, use JSON filter syntax.'),
    limit: z.number().optional().default(100).describe('Max rows to return (default 100, max 1000)'),
});
export const dbExplainInputSchema = z.object({
    resourceId: z.string().describe('Database resource identifier'),
    sql: z.string().describe('SQL query to explain (EXPLAIN ANALYZE)'),
});
// --- Helper ---
function zodToInputSchema(schema: z.ZodType) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}
// --- Tool Definitions ---
export const DB_TOOLS = [
    {
        name: 'db_list_resources',
        description: 'List all database resources (Postgres, MongoDB) available via the relay for this tenant. Returns resource IDs, types, and database names.',
        inputSchema: zodToInputSchema(dbListResourcesInputSchema),
        maxResultChars: 10_000,
        isConcurrencySafe: true,
    },
    {
        name: 'db_list_tables',
        description: 'List all tables/collections in a database resource. Use this to discover the schema before querying.',
        inputSchema: zodToInputSchema(dbListTablesInputSchema),
        maxResultChars: 10_000,
        isConcurrencySafe: true,
    },
    {
        name: 'db_describe_table',
        description: 'Describe a table/collection schema: columns, data types, constraints, indexes. Essential for understanding data structure before querying.',
        inputSchema: zodToInputSchema(dbDescribeTableInputSchema),
        maxResultChars: 15_000,
        isConcurrencySafe: true,
    },
    {
        name: 'db_query',
        description: 'Execute a read-only query against a database. For Postgres: SELECT statements only. For MongoDB: find operations. Results are automatically masked for PII. Use LIMIT to control result size.',
        inputSchema: zodToInputSchema(dbQueryInputSchema),
        maxResultChars: 30_000,
        isConcurrencySafe: true,
    },
    {
        name: 'db_explain',
        description: 'Run EXPLAIN ANALYZE on a query to understand execution plan, index usage, and performance characteristics. Use to diagnose slow queries.',
        inputSchema: zodToInputSchema(dbExplainInputSchema),
        maxResultChars: 15_000,
        isConcurrencySafe: true,
    },
];
export function createDbToolHandler(deps: DbToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null> {
    return async (name, input) => {
        switch (name) {
            case 'db_list_resources': {
                const resources = await deps.relayGateway.listResources(deps.tenantId);
                return JSON.stringify(resources);
            }
            case 'db_list_tables': {
                const validated = dbListTablesInputSchema.parse(input);
                const result = await deps.relayGateway.execute(deps.tenantId, {
                    resourceId: validated.resourceId,
                    operation: 'list_tables',
                    params: {},
                });
                return JSON.stringify(result);
            }
            case 'db_describe_table': {
                const validated = dbDescribeTableInputSchema.parse(input);
                const result = await deps.relayGateway.execute(deps.tenantId, {
                    resourceId: validated.resourceId,
                    operation: 'describe_table',
                    params: { tableName: validated.tableName },
                });
                return JSON.stringify(result);
            }
            case 'db_query': {
                const validated = dbQueryInputSchema.parse(input);
                const result = await deps.relayGateway.execute(deps.tenantId, {
                    resourceId: validated.resourceId,
                    operation: 'query',
                    params: { sql: validated.sql, limit: validated.limit },
                });
                return JSON.stringify(result);
            }
            case 'db_explain': {
                const validated = dbExplainInputSchema.parse(input);
                const result = await deps.relayGateway.execute(deps.tenantId, {
                    resourceId: validated.resourceId,
                    operation: 'explain',
                    params: { sql: validated.sql },
                });
                return JSON.stringify(result);
            }
            default:
                return null;
        }
    };
}
