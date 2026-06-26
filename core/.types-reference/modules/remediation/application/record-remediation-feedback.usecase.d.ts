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
export declare class RecordRemediationFeedbackUseCase {
    private readonly eventBus;
    private readonly agentMemory?;
    constructor(eventBus: IEventBus, agentMemory?: AgentMemory | undefined);
    execute(input: RemediationFeedbackInput): Promise<{
        feedbackId: string;
    }>;
}
