import { z } from 'zod';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export declare const recallPastIncidentsInputSchema: z.ZodObject<{
    query: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    query: string;
    tags?: string[] | undefined;
}, {
    query: string;
    tags?: string[] | undefined;
}>;
export declare const rememberFindingInputSchema: z.ZodObject<{
    finding: z.ZodString;
    category: z.ZodEnum<["root_cause", "dependency", "config", "deployment", "performance", "topology"]>;
    service: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    category: "deployment" | "root_cause" | "dependency" | "config" | "performance" | "topology";
    finding: string;
    service?: string | undefined;
}, {
    category: "deployment" | "root_cause" | "dependency" | "config" | "performance" | "topology";
    finding: string;
    service?: string | undefined;
}>;
export declare const getServiceTopologyInputSchema: z.ZodObject<{
    service: z.ZodString;
}, "strip", z.ZodTypeAny, {
    service: string;
}, {
    service: string;
}>;
export declare const getRecentChangesInputSchema: z.ZodObject<{
    service: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query?: string | undefined;
    service?: string | undefined;
}, {
    query?: string | undefined;
    service?: string | undefined;
}>;
export declare const checkRemediationHistoryInputSchema: z.ZodObject<{
    service: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query?: string | undefined;
    service?: string | undefined;
}, {
    query?: string | undefined;
    service?: string | undefined;
}>;
export declare const MEMORY_TOOLS: ToolDefinition[];
export interface MemoryToolDeps {
    agentMemory: AgentMemory;
    tenantId: TenantId;
    incidentId: IncidentId;
}
export declare function createMemoryToolHandler(deps: MemoryToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null>;
