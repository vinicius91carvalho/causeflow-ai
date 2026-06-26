import { logger } from '../../infra/logger.js';
import type { IEventBus, DomainEvent } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
export function registerFeedbackToMemorySubscriber(deps: { eventBus: IEventBus; agentMemory: AgentMemory }): void {
    deps.eventBus.subscribe('knowledge.feedback_recorded', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const incidentId = ((event.payload['incidentId'] as string | undefined) ?? '');
        const type = ((event.payload['type'] as string | undefined) ?? '');
        const actor = ((event.payload['actor'] as string | undefined) ?? '');
        if (!type)
            return;
        const isPositive = type === 'confirm_rca' || type === 'confirm_fix' || type === 'investigation_accurate';
        const sentiment = isPositive ? 'CONFIRMED' : 'REJECTED';
        const content = `[${sentiment}] Human feedback for incident ${incidentId}: "${type}" by ${actor}. ` +
            (isPositive
                ? 'The investigation findings were validated by a human operator.'
                : 'The investigation findings were challenged by a human operator. Review approach for similar incidents.');
        try {
            await deps.agentMemory.retain(tenantId, content, {
                tags: ['feedback', `incident:${incidentId}`, `verdict:${isPositive ? 'positive' : 'negative'}`],
                context: `feedback:${incidentId}:${type}`,
            });
        }
        catch (err) {
            logger.warn({ err, incidentId }, 'Failed to retain feedback — non-critical');
        }
    });
}
