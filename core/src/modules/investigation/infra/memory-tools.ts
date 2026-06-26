import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';

export interface MemoryToolDeps {
    agentMemory: AgentMemory;
    tenantId: TenantId;
    incidentId: IncidentId;
}

// --- Zod Schemas ---
export const recallPastIncidentsInputSchema = z.object({
    query: z.string().describe('Search query describing the symptoms, service, or error pattern'),
    tags: z.array(z.string()).optional().describe('Optional tags to filter by, e.g. ["service:payment-service"]'),
});
export const rememberFindingInputSchema = z.object({
    finding: z.string().describe('The important fact or discovery to remember for future investigations'),
    category: z.enum(['root_cause', 'dependency', 'config', 'deployment', 'performance', 'topology', 'operator_correction']).describe('Category of the finding'),
    service: z.string().optional().describe('Related service name, if applicable'),
});
export const getServiceTopologyInputSchema = z.object({
    service: z.string().describe('Service name to get topology information for'),
});
export const getRecentChangesInputSchema = z.object({
    service: z.string().optional().describe('Service name to filter changes for'),
    query: z.string().optional().describe('Optional search query for specific change types'),
});
export const checkRemediationHistoryInputSchema = z.object({
    service: z.string().optional().describe('Service name to check remediation history for'),
    query: z.string().optional().describe('Optional search query, e.g. "rollback" or "scaling"'),
});
// --- Helper ---
function zodToInputSchema(schema: z.ZodTypeAny) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}
// --- Tool Definitions ---
export const MEMORY_TOOLS = [
    {
        name: 'recall_past_incidents',
        description: 'Search memory for past incidents, root causes, and resolutions relevant to the current investigation. Returns historical context from similar past incidents.',
        inputSchema: zodToInputSchema(recallPastIncidentsInputSchema),
        maxResultChars: 20_000,
        isConcurrencySafe: true,
    },
    {
        name: 'remember_finding',
        description: 'Store an important discovery for future investigations. Use when you find a root cause, service dependency, configuration issue, or any critical fact that would help investigate similar incidents in the future.',
        inputSchema: zodToInputSchema(rememberFindingInputSchema),
        maxResultChars: 5_000,
        isConcurrencySafe: false, // write operation
    },
    {
        name: 'get_service_topology',
        description: 'Get known dependencies, upstream/downstream services, and historical behavior patterns for a service. Built from past investigations.',
        inputSchema: zodToInputSchema(getServiceTopologyInputSchema),
        maxResultChars: 15_000,
        isConcurrencySafe: true,
    },
    {
        name: 'get_recent_changes',
        description: 'Search memory for recent deployments, config changes, and infrastructure changes that may correlate with the current incident.',
        inputSchema: zodToInputSchema(getRecentChangesInputSchema),
        maxResultChars: 20_000,
        isConcurrencySafe: true,
    },
    {
        name: 'check_remediation_history',
        description: 'Check what remediations have been tried for similar issues and whether they succeeded or failed. Helps avoid repeating failed approaches.',
        inputSchema: zodToInputSchema(checkRemediationHistoryInputSchema),
        maxResultChars: 15_000,
        isConcurrencySafe: true,
    },
];
export function createMemoryToolHandler(deps: MemoryToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null> {
    return async (name, input) => {
        const tid = deps.tenantId;
        switch (name) {
            case 'recall_past_incidents': {
                const validated = recallPastIncidentsInputSchema.parse(input);
                const tags = ['investigation', ...(validated.tags ?? [])];
                const memories = await deps.agentMemory.recall(tid, validated.query, {
                    maxResults: 5, tags, budget: 'mid',
                });
                if (memories.length === 0)
                    return JSON.stringify({ results: [], message: 'No past incidents found matching this query.' });
                return JSON.stringify({
                    results: memories.map((m, i) => ({ rank: i + 1, type: m.type, text: m.text })),
                    memoriesFound: memories.length,
                });
            }
            case 'remember_finding': {
                const validated = rememberFindingInputSchema.parse(input);
                const tags = ['investigation', `category:${validated.category}`];
                if (validated.service)
                    tags.push(`service:${validated.service}`);
                await deps.agentMemory.retain(tid, validated.finding, {
                    tags,
                    context: `agent-discovery:${deps.incidentId}`,
                });
                return JSON.stringify({ stored: true, message: 'Finding stored in memory for future investigations.' });
            }
            case 'get_service_topology': {
                const validated = getServiceTopologyInputSchema.parse(input);
                const memories = await deps.agentMemory.recall(tid, `dependencies and topology of ${validated.service}`, {
                    maxResults: 5, tags: ['topology', `service:${validated.service}`], budget: 'mid',
                });
                if (memories.length === 0) {
                    return JSON.stringify({ results: [], message: `No topology information found for "${validated.service}". This service may not have been involved in past investigations yet.` });
                }
                return JSON.stringify({
                    results: memories.map((m) => ({ type: m.type, text: m.text })),
                });
            }
            case 'get_recent_changes': {
                const validated = getRecentChangesInputSchema.parse(input);
                const query = validated.query
                    ? `${validated.query} ${validated.service ?? ''}`.trim()
                    : `recent deployments and changes ${validated.service ?? ''}`.trim();
                const tags = ['deploy'];
                if (validated.service)
                    tags.push(`service:${validated.service}`);
                const memories = await deps.agentMemory.recall(tid, query, {
                    maxResults: 5, tags, budget: 'mid',
                });
                if (memories.length === 0)
                    return JSON.stringify({ results: [], message: 'No recent changes found in memory.' });
                return JSON.stringify({
                    results: memories.map((m) => ({ type: m.type, text: m.text })),
                });
            }
            case 'check_remediation_history': {
                const validated = checkRemediationHistoryInputSchema.parse(input);
                const query = validated.query
                    ? `${validated.query} ${validated.service ?? ''}`.trim()
                    : `remediation outcomes ${validated.service ?? ''}`.trim();
                const tags = ['remediation'];
                if (validated.service)
                    tags.push(`service:${validated.service}`);
                const memories = await deps.agentMemory.recall(tid, query, {
                    maxResults: 5, tags, budget: 'mid',
                });
                if (memories.length === 0)
                    return JSON.stringify({ results: [], message: 'No remediation history found.' });
                return JSON.stringify({
                    results: memories.map((m) => ({ type: m.type, text: m.text })),
                });
            }
            default:
                return null;
        }
    };
}
