import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { RemediationId, TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export declare class DynamoRemediationRepository implements IRemediationRepository {
    create(remediation: Remediation): Promise<Remediation>;
    findById(tenantId: TenantId, id: RemediationId): Promise<Remediation | null>;
    findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Remediation[]>;
    update(tenantId: TenantId, id: RemediationId, data: Partial<Remediation>): Promise<Remediation>;
}
