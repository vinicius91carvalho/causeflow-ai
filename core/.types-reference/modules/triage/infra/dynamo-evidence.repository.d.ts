import type { IEvidenceRepository, Evidence } from '../domain/evidence.repository.js';
import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
export declare class DynamoEvidenceRepository implements IEvidenceRepository {
    create(evidence: Evidence): Promise<Evidence>;
    findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Evidence[]>;
    listByAgentRole(incidentId: IncidentId, agentRole: AgentRole): Promise<Evidence[]>;
}
