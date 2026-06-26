import { logger } from '../../infra/logger.js';
import type { IEventBus, DomainEvent } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
/**
 * Extracts service names from investigation findings and retains
 * discovered topology relationships in Hindsight memory.
 */
export function registerTopologyDiscoverySubscriber(deps: { eventBus: IEventBus; agentMemory: AgentMemory }): void {
    deps.eventBus.subscribe('investigation.completed', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const incidentId = (event.payload['incidentId'] as string) ?? '';
        const rootCause = (event.payload['rootCause'] as string) ?? '';
        // agentsUsed not needed for topology discovery
        const actions = (event.payload['recommendedActions'] as Array<{ action: string; params?: Record<string, unknown> }>) ?? [];
        // Extract service names from root cause text and actions
        const serviceNames = extractServiceNames(rootCause, actions);
        if (serviceNames.length < 2)
            return; // Need at least 2 services for a relationship
        const relationships = serviceNames.map((s) => s).join(', ');
        const content = `Incident ${incidentId} involved services: ${relationships}. ` +
            `Root cause: "${rootCause.slice(0, 200)}". ` +
            `These services may have dependencies or shared infrastructure.`;
        const tags = ['topology', ...serviceNames.map((s) => `service:${s}`)];
        try {
            await deps.agentMemory.retain(tenantId, content, {
                tags,
                context: `topology-discovery:${incidentId}`,
                metadata: { incidentId, servicesFound: serviceNames.join(',') },
            });
            logger.info({ incidentId, tenantId, services: serviceNames }, 'Topology discovery retained in memory');
        }
        catch (err) {
            logger.warn({ err, incidentId }, 'Failed to retain topology discovery — non-critical');
        }
    });
}
/**
 * Simple heuristic to extract service-like names from investigation text.
 * Looks for patterns: word-service, word-api, word-worker, word-db, etc.
 */
function extractServiceNames(rootCause: string, actions: Array<{ action: string; params?: Record<string, unknown> }>) {
    const text = `${rootCause} ${actions.map((a) => `${a.action} ${JSON.stringify(a.params ?? {})}`).join(' ')}`;
    const servicePattern = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:-(?:service|api|worker|db|cache|queue|gateway|proxy|scheduler|consumer)))\b/gi;
    const matches = text.match(servicePattern) ?? [];
    const unique = [...new Set(matches.map((m) => m.toLowerCase()))];
    return unique.slice(0, 10); // Cap at 10 services
}
