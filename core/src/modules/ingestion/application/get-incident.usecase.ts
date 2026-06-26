import { IncidentNotFoundError } from '../domain/incident.errors.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
export class GetIncidentUseCase {
    repo;
    constructor(repo: IIncidentRepository) {
        this.repo = repo;
    }
    async execute(tenantId: TenantId, incidentId: IncidentId): Promise<Incident> {
        const incident = await this.repo.findById(tenantId, incidentId);
        if (!incident) {
            throw new IncidentNotFoundError(incidentId);
        }
        return incident;
    }
}
