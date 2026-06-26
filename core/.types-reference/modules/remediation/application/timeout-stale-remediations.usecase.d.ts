import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export interface TimeoutStaleRemediationsInput {
    tenantIds: TenantId[];
    incidentIds: IncidentId[];
}
export interface TimeoutResult {
    rejected: number;
    errors: number;
}
export declare class TimeoutStaleRemediationsUseCase {
    private readonly remediationRepo;
    private readonly incidentRepo;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository);
    execute(input: TimeoutStaleRemediationsInput): Promise<TimeoutResult>;
}
