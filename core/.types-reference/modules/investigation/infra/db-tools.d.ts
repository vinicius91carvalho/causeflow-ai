import { z } from 'zod';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { IRelayGateway } from '../../../shared/application/ports/relay-gateway.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare const dbListResourcesInputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const dbListTablesInputSchema: z.ZodObject<{
    resourceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    resourceId: string;
}, {
    resourceId: string;
}>;
export declare const dbDescribeTableInputSchema: z.ZodObject<{
    resourceId: z.ZodString;
    tableName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    resourceId: string;
    tableName: string;
}, {
    resourceId: string;
    tableName: string;
}>;
export declare const dbQueryInputSchema: z.ZodObject<{
    resourceId: z.ZodString;
    sql: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    resourceId: string;
    sql: string;
}, {
    resourceId: string;
    sql: string;
    limit?: number | undefined;
}>;
export declare const dbExplainInputSchema: z.ZodObject<{
    resourceId: z.ZodString;
    sql: z.ZodString;
}, "strip", z.ZodTypeAny, {
    resourceId: string;
    sql: string;
}, {
    resourceId: string;
    sql: string;
}>;
export declare const DB_TOOLS: ToolDefinition[];
export interface DbToolDeps {
    relayGateway: IRelayGateway;
    tenantId: TenantId;
}
export declare function createDbToolHandler(deps: DbToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null>;
