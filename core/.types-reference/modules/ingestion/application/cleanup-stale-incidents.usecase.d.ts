import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface CleanupStaleIncidentsInput {
    tenantIds: TenantId[];
}
export interface CleanupResult {
    closed: number;
    errors: number;
}
export declare class CleanupStaleIncidentsUseCase {
    private readonly incidentRepo;
    constructor(incidentRepo: IIncidentRepository);
    execute(input: CleanupStaleIncidentsInput): Promise<CleanupResult>;
}
