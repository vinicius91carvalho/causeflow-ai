import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId, EvidenceId } from '../../../shared/domain/value-objects.js';
export interface Evidence {
    tenantId: TenantId;
    incidentId: IncidentId;
    evidenceId: EvidenceId;
    agentRole: AgentRole;
    evidenceType: 'log_snippet' | 'metric_snapshot' | 'trace_span' | 'resource_state' | 'agent_reasoning' | 'user_context';
    content: string;
    metadata?: {
        source?: string;
        timeRange?: string;
        confidence?: number;
        category?: string;
    };
    createdAt: string;
}
export interface IEvidenceRepository {
    create(evidence: Evidence): Promise<Evidence>;
    findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Evidence[]>;
    listByAgentRole(incidentId: IncidentId, agentRole: AgentRole): Promise<Evidence[]>;
}
