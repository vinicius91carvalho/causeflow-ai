import { logger } from '../../infra/logger.js';
import type { IEventBus, DomainEvent } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
export function registerRemediationToMemorySubscriber(deps: { eventBus: IEventBus; agentMemory: AgentMemory }): void {
    deps.eventBus.subscribe('remediation.executed', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const incidentId = ((event.payload['incidentId'] as string | undefined) ?? '');
        const remediationId = ((event.payload['remediationId'] as string | undefined) ?? '');
        const status = ((event.payload['status'] as string | undefined) ?? 'unknown');
        const stepsCompleted = (event.payload['stepsCompleted'] as number | undefined) ?? 0;
        const totalSteps = (event.payload['totalSteps'] as number | undefined) ?? 0;
        const content = `Remediation ${remediationId} for incident ${incidentId}: ${status.toUpperCase()}. ` +
            `${String(stepsCompleted)}/${String(totalSteps)} steps completed.` +
            (status === 'failed' ? ' Some remediation steps failed — investigate before retrying.' : '');
        try {
            await deps.agentMemory.retain(tenantId, content, {
                tags: ['remediation', `outcome:${status}`, `incident:${incidentId}`],
                context: `remediation-executed:${remediationId}`,
                metadata: { incidentId, remediationId, status },
            });
            logger.info({ remediationId, tenantId, status }, 'Remediation outcome retained in memory');
        }
        catch (err) {
            logger.warn({ err, remediationId }, 'Failed to retain remediation outcome — non-critical');
        }
    });
    deps.eventBus.subscribe('remediation.feedback_recorded', async (event: DomainEvent) => {
        const tenantId = event.tenantId;
        const incidentId = ((event.payload['incidentId'] as string | undefined) ?? '');
        const remediationId = ((event.payload['remediationId'] as string | undefined) ?? '');
        const type = ((event.payload['type'] as string | undefined) ?? '');
        if (!type)
            return;
        const severity = type === 'remediation_made_worse' ? 'WARNING' : type === 'remediation_ineffective' ? 'NOTE' : 'POSITIVE';
        const content = `[${severity}] Remediation feedback for incident ${incidentId}: "${type}". ` +
            (type === 'remediation_made_worse'
                ? 'The remediation MADE THINGS WORSE. Do not repeat this approach for similar incidents.'
                : type === 'remediation_effective'
                    ? 'The remediation was effective. This approach works for this type of incident.'
                    : 'The remediation was ineffective. Consider alternative approaches.');
        try {
            await deps.agentMemory.retain(tenantId, content, {
                tags: ['remediation', 'feedback', `outcome:${type}`, `incident:${incidentId}`],
                context: `remediation-feedback:${remediationId}`,
            });
        }
        catch (err) {
            logger.warn({ err, remediationId }, 'Failed to retain remediation feedback — non-critical');
        }
    });
}
