import { createHash } from 'node:crypto';
import { logger } from '../../infra/logger.js';
import type { IEventBus, DomainEvent } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
import type { IRunbookRegistryRepository } from '../../domain/runbook-registry.repository.js';
import { tenantId as toTenantId } from '../../domain/value-objects.js';
export function registerInvestigationToMemorySubscriber(deps: { eventBus: IEventBus; agentMemory: AgentMemory; runbookRegistry?: IRunbookRegistryRepository }): void {
    deps.eventBus.subscribe('investigation.completed', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const incidentId = (event.payload['incidentId'] as string) ?? '';
        const rootCause = (event.payload['rootCause'] as string) ?? '';
        const agentsUsed = (event.payload['agentsUsed'] as string[]) ?? [];
        const actions = (event.payload['recommendedActions'] as Array<Record<string, unknown>>) ?? [];
        const durationMs = event.payload['investigationDurationMs'] as number | undefined;
        const costUsd = event.payload['totalCostUsd'] as number | undefined;
        const proposedFix = event.payload['proposedFix'];
        if (rootCause.length < 20)
            return;
        const actionSummary = actions.map((a: Record<string, unknown>) => a.action).join(', ');
        const durationStr = durationMs ? ` Investigation took ${Math.round(durationMs / 1000)}s.` : '';
        const fixStr = proposedFix ? ` A code fix was proposed.` : '';
        const content = `Incident ${incidentId}: Root cause was "${rootCause}". ` +
            `Agents used: ${agentsUsed.join(', ')}. ` +
            `Recommended actions: ${actionSummary}.` +
            durationStr + fixStr;
        const tags = [
            'investigation',
            ...agentsUsed.map((a) => `agent:${String(a)}`),
        ];
        // 1. Retain in Hindsight
        try {
            await deps.agentMemory.retain(tenantId, content, {
                tags,
                context: `investigation-completed:${incidentId}`,
                metadata: { incidentId, agentsUsed: agentsUsed.join(','), costUsd: String(costUsd ?? 0) },
            });
            logger.info({ incidentId, tenantId }, 'Investigation facts retained in agent memory');
        }
        catch (err) {
            logger.warn({ err, incidentId }, 'Failed to retain investigation memory — non-critical');
        }
        // 2. Update RunbookRegistry (occurrence tracking for automation gates)
        if (deps.runbookRegistry) {
            try {
                const normalized = rootCause.toLowerCase().trim();
                const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
                const now = new Date().toISOString();
                const existing = await deps.runbookRegistry.findByHash(toTenantId(tenantId), hash);
                await deps.runbookRegistry.upsert({
                    tenantId: toTenantId(tenantId),
                    rootCauseHash: hash,
                    rootCauseSummary: rootCause.slice(0, 500),
                    occurrences: (existing?.occurrences ?? 0) + 1,
                    confirmations: existing?.confirmations ?? 0,
                    lastSeen: now,
                    fixAction: (actions[0]?.action as string) ?? existing?.fixAction ?? '',
                    fixDescription: existing?.fixDescription ?? '',
                    automated: existing?.automated ?? false,
                    createdAt: existing?.createdAt ?? now,
                    updatedAt: now,
                });
            }
            catch (err) {
                logger.warn({ err, incidentId }, 'Failed to update runbook registry — non-critical');
            }
        }
    });
}
