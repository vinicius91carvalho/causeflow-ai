import { v4 as uuidv4 } from 'uuid';
import { feedbackId } from '../../../shared/domain/value-objects.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface RemediationFeedbackInput {
    tenantId: TenantId;
    remediationId: string;
    incidentId: string;
    type: 'remediation_effective' | 'remediation_ineffective' | 'remediation_made_worse';
    actor: string;
    freeText?: string;
}

export class RecordRemediationFeedbackUseCase {
    eventBus;
    agentMemory;
    constructor(eventBus: IEventBus, agentMemory?: AgentMemory) {
        this.eventBus = eventBus;
        this.agentMemory = agentMemory;
    }
    async execute(input: RemediationFeedbackInput) {
        const { tenantId, remediationId, incidentId, type, actor, freeText } = input;
        const fbId = feedbackId(uuidv4());
        // Retain feedback in Hindsight (consumed by remediation-to-memory subscriber via event)
        if (this.agentMemory) {
            const severity = type === 'remediation_made_worse' ? 'WARNING' : type === 'remediation_effective' ? 'POSITIVE' : 'NOTE';
            const content = `[${severity}] Remediation feedback for incident ${incidentId} (remediation ${remediationId}): "${type}" by ${actor}.` +
                (freeText ? ` Comment: "${freeText}".` : '');
            await this.agentMemory.retain(tenantId, content, {
                tags: ['remediation', 'feedback', `outcome:${type}`, `incident:${incidentId}`],
                context: `remediation-feedback:${remediationId}`,
            });
        }
        await this.eventBus.publish({
            eventType: 'remediation.feedback_recorded',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: { remediationId, incidentId, type, feedbackId: fbId },
        });
        return { feedbackId: fbId };
    }
}
