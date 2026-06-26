import { NotFoundError } from '../../../shared/domain/errors.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { RemediationId, TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export class GetRemediationUseCase {
    repo;
    constructor(repo: IRemediationRepository) {
        this.repo = repo;
    }
    async getById(tenantId: TenantId, remediationId: RemediationId): Promise<Remediation> {
        const remediation = await this.repo.findById(tenantId, remediationId);
        if (!remediation) {
            throw new NotFoundError('Remediation', remediationId);
        }
        return remediation;
    }
    async listByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Remediation[]> {
        return this.repo.findByIncident(tenantId, incidentId);
    }
}
