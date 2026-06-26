import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { tenantId as toTenantId, incidentId as toIncidentId } from '../../../shared/domain/value-objects.js';
import { MEMORY_TOOLS, createMemoryToolHandler } from './memory-tools.js';
import { AWS_API_CALL_TOOL, createAwsApiToolHandler } from './aws-api-tool.js';
import {
    DEFAULT_RELAY_TOOL_REGISTRY,
    LIST_RELAY_RESOURCES_TOOL,
    buildStaticRelayToolDefinitions,
    isRelayToolName,
} from '../application/relay-tools/index.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { CloudCredentials } from '../../../shared/application/ports/cloud-provider.port.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
import type { IRelayGateway } from '../../../shared/application/ports/relay-gateway.port.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

export interface ToolHandlerDeps {
    cloudCredentials: CloudCredentials;
    incidentRepo: IIncidentRepository;
    tenantId: TenantId;
    incidentId: IncidentId;
    agentMemory?: AgentMemory;
    integrationToolProvider?: IntegrationToolProvider;
    relayGateway?: IRelayGateway;
}

// --- Zod Schemas for Input Validation ---
export const getIncidentDetailsInputSchema = z.object({
    tenantId: z.string().describe('Tenant identifier'),
    incidentId: z.string().describe('Incident identifier'),
});
// --- Helper: convert Zod schema to ToolDefinition inputSchema ---
function zodToInputSchema(schema: z.ZodTypeAny) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}
// --- Tool Definitions ---
export const incidentDetailsTool = {
    name: 'get_incident_details',
    description: 'Fetch full incident details including title, description, severity, and current status.',
    inputSchema: zodToInputSchema(getIncidentDetailsInputSchema),
    maxResultChars: 10_000,
    isConcurrencySafe: true,
};

// --- Tool Groupings (wave agents use aws_api_call for all AWS interactions) ---
export const LOG_TOOLS = [AWS_API_CALL_TOOL, incidentDetailsTool, ...MEMORY_TOOLS];
export const METRIC_TOOLS = [AWS_API_CALL_TOOL, incidentDetailsTool, ...MEMORY_TOOLS];
export const INFRA_TOOLS = [AWS_API_CALL_TOOL, incidentDetailsTool, ...MEMORY_TOOLS];
export const CHANGE_DETECTION_TOOLS = [AWS_API_CALL_TOOL, incidentDetailsTool, ...MEMORY_TOOLS];

/**
 * Relay-backed investigation tools (9 drivers × N operations).
 * Each tool is a declarative spec in `application/relay-tools/drivers/<type>.tools.ts`.
 * Agents always see `list_relay_resources` as the entry point; driver-specific
 * tools are gated at runtime to the types actually connected.
 */
export const RELAY_TOOLS: ToolDefinition[] = buildStaticRelayToolDefinitions();

// --- Orchestrator: all tools in one agent ---
export const ORCHESTRATOR_TOOLS: ToolDefinition[] = [
    incidentDetailsTool,
    AWS_API_CALL_TOOL,
    ...MEMORY_TOOLS,
    ...RELAY_TOOLS,
];

export function createToolHandler(deps: ToolHandlerDeps): (name: string, input: Record<string, unknown>) => Promise<string> {
    const memoryHandler = deps.agentMemory
        ? createMemoryToolHandler({ agentMemory: deps.agentMemory, tenantId: deps.tenantId, incidentId: deps.incidentId })
        : null;
    const awsApiHandler = createAwsApiToolHandler(deps.cloudCredentials);
    const relayRegistry = DEFAULT_RELAY_TOOL_REGISTRY;
    const relayDriverHandler = deps.relayGateway
        ? relayRegistry.createHandler({ relayGateway: deps.relayGateway, tenantId: deps.tenantId })
        : null;

    return async (name, input) => {
        // Relay meta-tool: list available resources
        if (name === LIST_RELAY_RESOURCES_TOOL.name) {
            if (!deps.relayGateway || !deps.relayGateway.isConnected(deps.tenantId)) {
                return JSON.stringify({ connected: false, resources: [] });
            }
            const resources = await deps.relayGateway.listResources(deps.tenantId);
            return JSON.stringify({ connected: true, resources });
        }

        // Relay driver tools (postgres_*, mongodb_*, redis_*, ...)
        if (isRelayToolName(name, relayRegistry) && relayDriverHandler) {
            return relayDriverHandler(name, input);
        }
        if (isRelayToolName(name, relayRegistry) && !relayDriverHandler) {
            return JSON.stringify({
                status: 'not_connected',
                reason: 'Relay gateway is not configured for this tenant.',
                retriable: false,
                hint: 'Ensure the customer has deployed the relay agent and that config.relay.enabled is set.',
            });
        }

        // Try AWS API tool (generic read-only)
        const awsResult = await awsApiHandler(name, input);
        if (awsResult !== null)
            return awsResult;
        // Try memory tools (recall, remember, topology, changes, remediation history)
        if (memoryHandler) {
            const memoryResult = await memoryHandler(name, input);
            if (memoryResult !== null)
                return memoryResult;
        }
        // Try Composio integration tools (composio_ prefix)
        if (deps.integrationToolProvider?.isOwnTool(name)) {
            return deps.integrationToolProvider.executeAction(deps.tenantId, name, input);
        }
        switch (name) {
            case 'get_incident_details': {
                const validated = getIncidentDetailsInputSchema.parse(input);
                const tid = toTenantId(validated.tenantId);
                const iid = toIncidentId(validated.incidentId);
                const incident = await deps.incidentRepo.findById(tid, iid);
                if (!incident)
                    return JSON.stringify({ error: 'Incident not found' });
                return JSON.stringify(incident);
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    };
}
