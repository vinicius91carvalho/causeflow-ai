import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { InvestigationRegistry } from './investigation-registry.js';
export declare class AbortInvestigationUseCase {
    private readonly incidentRepo;
    private readonly eventBus;
    private readonly registry;
    constructor(incidentRepo: IIncidentRepository, eventBus: IEventBus, registry: InvestigationRegistry);
    execute(tenantId: TenantId, incidentId: IncidentId, abortedBy: string): Promise<{
        incidentId: string;
        status: string;
    }>;
}
