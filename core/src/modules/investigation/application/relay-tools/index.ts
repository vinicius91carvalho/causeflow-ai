import type { ToolDefinition } from '../../../../shared/application/ports/agent-runner.port.js';
import type { IRelayGateway } from '../../../../shared/application/ports/relay-gateway.port.js';
import type { TenantId } from '../../../../shared/domain/value-objects.js';
import { RelayToolRegistry } from './tool-registry.js';
import { POSTGRES_TOOLS } from './drivers/postgres.tools.js';
import { MYSQL_TOOLS } from './drivers/mysql.tools.js';
import { MONGODB_TOOLS } from './drivers/mongodb.tools.js';
import { REDIS_TOOLS } from './drivers/redis.tools.js';
import { ELASTICSEARCH_TOOLS } from './drivers/elasticsearch.tools.js';
import { HTTP_TOOLS } from './drivers/http.tools.js';
import { PROMETHEUS_TOOLS } from './drivers/prometheus.tools.js';
import { CLOUDWATCH_TOOLS } from './drivers/cloudwatch.tools.js';
import { KUBERNETES_TOOLS } from './drivers/kubernetes.tools.js';

export { RelayToolRegistry } from './tool-registry.js';
export type { ToolSpec, AnyToolSpec } from './tool-spec.js';
export type { RelayToolEnvelope } from './response-handler.js';

/**
 * Singleton registry populated with every driver's tool specs.
 * Extend the relay with a new driver → add `drivers/<name>.tools.ts` →
 * import it here and pass it to `registerAll`. Nothing else to touch.
 */
export function buildDefaultRelayToolRegistry(): RelayToolRegistry {
    const registry = new RelayToolRegistry();
    registry.registerAll(POSTGRES_TOOLS);
    registry.registerAll(MYSQL_TOOLS);
    registry.registerAll(MONGODB_TOOLS);
    registry.registerAll(REDIS_TOOLS);
    registry.registerAll(ELASTICSEARCH_TOOLS);
    registry.registerAll(HTTP_TOOLS);
    registry.registerAll(PROMETHEUS_TOOLS);
    registry.registerAll(CLOUDWATCH_TOOLS);
    registry.registerAll(KUBERNETES_TOOLS);
    return registry;
}

export const DEFAULT_RELAY_TOOL_REGISTRY = buildDefaultRelayToolRegistry();

/**
 * Compact meta-tool the agent uses first — lists the connected resources
 * so subsequent driver-specific tools know what `resourceId` values exist.
 */
export const LIST_RELAY_RESOURCES_TOOL: ToolDefinition = {
    name: 'list_relay_resources',
    description: 'List database/data resources available through the relay for the current tenant. Returns id, type, name, database, and capabilities. Call this FIRST before any other relay tool so you know what is connected and can pick the right resourceId.',
    inputSchema: { type: 'object', properties: {} },
    maxResultChars: 5_000,
    isConcurrencySafe: true,
};

export interface BuildRelayToolsOptions {
    registry?: RelayToolRegistry;
    relayGateway: IRelayGateway;
    tenantId: TenantId;
}

/**
 * Build the full relay toolset for a tenant. Dynamically filters the toolbox
 * to only expose tools whose driverType has at least one connected resource.
 * The `list_relay_resources` meta-tool is always included.
 */
export async function buildRelayTools(opts: BuildRelayToolsOptions): Promise<{
    tools: ToolDefinition[];
    handler: (name: string, input: Record<string, unknown>) => Promise<string>;
}> {
    const registry = opts.registry ?? DEFAULT_RELAY_TOOL_REGISTRY;
    const specsHandler = registry.createHandler({ relayGateway: opts.relayGateway, tenantId: opts.tenantId });

    let resources: Awaited<ReturnType<IRelayGateway['listResources']>> = [];
    if (opts.relayGateway.isConnected(opts.tenantId)) {
        resources = await opts.relayGateway.listResources(opts.tenantId).catch(() => []);
    }

    const driverTools = resources.length > 0
        ? registry.getToolDefinitionsForResources(resources)
        : [];

    const handler = async (name: string, input: Record<string, unknown>): Promise<string> => {
        if (name === LIST_RELAY_RESOURCES_TOOL.name) {
            if (!opts.relayGateway.isConnected(opts.tenantId)) {
                return JSON.stringify({ connected: false, resources: [] });
            }
            const current = await opts.relayGateway.listResources(opts.tenantId);
            return JSON.stringify({ connected: true, resources: current });
        }
        if (registry.has(name)) {
            return specsHandler(name, input);
        }
        return '';
    };

    const tools = [LIST_RELAY_RESOURCES_TOOL, ...driverTools];

    return { tools, handler };
}

/** Static toolset — every driver's tools without gateway probing. Useful for tests and metadata. */
export function buildStaticRelayToolDefinitions(registry: RelayToolRegistry = DEFAULT_RELAY_TOOL_REGISTRY): ToolDefinition[] {
    return [LIST_RELAY_RESOURCES_TOOL, ...registry.getAllToolDefinitions()];
}

/** Tool names owned by the relay registry — use to route dispatch in composed handlers */
export function isRelayToolName(name: string, registry: RelayToolRegistry = DEFAULT_RELAY_TOOL_REGISTRY): boolean {
    return name === LIST_RELAY_RESOURCES_TOOL.name || registry.has(name);
}
