import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IRunbookRegistryRepository } from '../../../shared/domain/runbook-registry.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { KnownSolutionStatus } from '../../ingestion/domain/incident.entity.js';
export interface RespondKnownSolutionInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    response: 'accepted' | 'declined';
    actor: string;
    rootCauseHash?: string;
}
export declare class RespondKnownSolutionUseCase {
    private readonly incidentRepo;
    private readonly eventBus;
    private readonly runbookRegistry?;
    constructor(incidentRepo: IIncidentRepository, eventBus: IEventBus, runbookRegistry?: IRunbookRegistryRepository | undefined);
    execute(input: RespondKnownSolutionInput): Promise<{
        status: KnownSolutionStatus;
    }>;
}
