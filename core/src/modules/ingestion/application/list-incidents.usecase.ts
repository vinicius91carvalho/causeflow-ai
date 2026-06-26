import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface ListIncidentsInput {
    tenantId: TenantId;
    limit?: number;
    cursor?: string;
}

export class ListIncidentsUseCase {
    repo;
    constructor(repo: IIncidentRepository) {
        this.repo = repo;
    }
    async execute(input: ListIncidentsInput) {
        return this.repo.listByTenant(input.tenantId, {
            limit: input.limit ?? 20,
            cursor: input.cursor,
        });
    }
}
