import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export interface AddInvestigationContextInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    context: string;
    addedBy: string;
    reinvestigate?: boolean;
    suggestedAgents?: string[];
}
export interface AddInvestigationContextDeps {
    incidentRepo: IIncidentRepository;
    evidenceRepo: IEvidenceRepository;
    eventBus: IEventBus;
    messageQueue?: MessageQueue;
    investigationQueueUrl?: string;
}
export declare class AddInvestigationContextUseCase {
    private readonly deps;
    constructor(deps: AddInvestigationContextDeps);
    execute(input: AddInvestigationContextInput): Promise<{
        evidenceId: string;
        incidentId: string;
        reinvestigationTriggered: boolean;
    }>;
}
