import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { RemediationId, TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export declare class GetRemediationUseCase {
    private readonly repo;
    constructor(repo: IRemediationRepository);
    getById(tenantId: TenantId, remediationId: RemediationId): Promise<Remediation>;
    listByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Remediation[]>;
}
