import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId, EvidenceId, ToolCallId } from '../../../shared/domain/value-objects.js';
export interface Evidence {
    tenantId: TenantId;
    incidentId: IncidentId;
    evidenceId: EvidenceId;
    agentRole: AgentRole;
    evidenceType: 'log_snippet' | 'metric_snapshot' | 'trace_span' | 'resource_state' | 'agent_reasoning' | 'user_context' | 'historical_context';
    content: string;
    /** Links this evidence to the exact tool call that produced it. */
    toolCallId?: ToolCallId;
    /** What the agent claims this evidence proves. */
    claim?: string;
    /** Literal substring from the tool output supporting the claim. */
    quote?: string;
    metadata?: {
        source?: string;
        timeRange?: string;
        confidence?: number;
        category?: string;
        toolName?: string;
        label?: string;
        /** AC-059: LLM completion attribution for OSS connector fallback. */
        llmModel?: string;
        llmConnector?: string;
        phase?: string;
    };
    createdAt: string;
}
export interface IEvidenceRepository {
    create(evidence: Evidence): Promise<Evidence>;
    findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Evidence[]>;
    listByAgentRole(incidentId: IncidentId, agentRole: AgentRole): Promise<Evidence[]>;
}
