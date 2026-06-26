import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { IncidentStatus } from '../../../shared/domain/types.js';
export declare class UpdateIncidentStatusUseCase {
    private readonly repo;
    private readonly eventBus;
    constructor(repo: IIncidentRepository, eventBus: IEventBus);
    execute(tenantId: TenantId, incidentId: IncidentId, newStatus: IncidentStatus): Promise<Incident>;
}
