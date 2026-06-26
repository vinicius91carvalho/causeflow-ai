import type { IEventBus } from '../../../shared/domain/events.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { IRunbookRegistryRepository } from '../../../shared/domain/runbook-registry.repository.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export interface InvestigationFeedbackInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    type: 'investigation_accurate' | 'investigation_inaccurate' | 'investigation_partial';
    actor: string;
    freeText?: string;
    agentFeedback?: Array<{
        agentRole: string;
        quality: number;
    }>;
    rootCauseHash?: string;
}
export declare class RecordInvestigationFeedbackUseCase {
    private readonly eventBus;
    private readonly agentMemory?;
    private readonly runbookRegistry?;
    constructor(eventBus: IEventBus, agentMemory?: AgentMemory | undefined, runbookRegistry?: IRunbookRegistryRepository | undefined);
    execute(input: InvestigationFeedbackInput): Promise<{
        feedbackIds: string[];
    }>;
}
