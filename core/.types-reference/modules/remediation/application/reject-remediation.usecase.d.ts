import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, RemediationId } from '../../../shared/domain/value-objects.js';
export interface RejectRemediationInput {
    tenantId: TenantId;
    remediationId: RemediationId;
    rejectedBy: string;
    reason?: string;
}
export declare class RejectRemediationUseCase {
    private readonly remediationRepo;
    private readonly incidentRepo;
    private readonly eventBus;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository, eventBus: IEventBus);
    execute(input: RejectRemediationInput): Promise<Remediation>;
}
