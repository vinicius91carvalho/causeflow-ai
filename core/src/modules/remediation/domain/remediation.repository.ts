import type { Remediation } from './remediation.entity.js';
import type { RemediationId, TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export interface IRemediationRepository {
    create(remediation: Remediation): Promise<Remediation>;
    findById(tenantId: TenantId, remediationId: RemediationId): Promise<Remediation | null>;
    findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Remediation[]>;
    update(tenantId: TenantId, remediationId: RemediationId, data: Partial<Remediation>): Promise<Remediation>;
}
