import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
export declare class GetIncidentUseCase {
    private readonly repo;
    constructor(repo: IIncidentRepository);
    execute(tenantId: TenantId, incidentId: IncidentId): Promise<Incident>;
}
