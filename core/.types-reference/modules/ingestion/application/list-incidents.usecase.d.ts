import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { Incident } from '../domain/incident.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface ListIncidentsInput {
    tenantId: TenantId;
    limit?: number;
    cursor?: string;
}
export declare class ListIncidentsUseCase {
    private readonly repo;
    constructor(repo: IIncidentRepository);
    execute(input: ListIncidentsInput): Promise<{
        items: Incident[];
        cursor?: string;
    }>;
}
