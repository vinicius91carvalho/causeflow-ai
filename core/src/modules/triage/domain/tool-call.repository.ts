import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId, ToolCallId } from '../../../shared/domain/value-objects.js';

export interface ToolCallLog {
    tenantId: TenantId;
    incidentId: IncidentId;
    toolCallId: ToolCallId;
    agentRole: AgentRole;
    name: string;
    origin: 'real' | 'synthetic_memory';
    input: Record<string, unknown>;
    output: string;
    success: boolean;
    metadata?: {
        provider?: string;
        label?: string;
    };
    createdAt: string;
}

export interface IToolCallRepository {
    create(record: ToolCallLog): Promise<ToolCallLog>;
    findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<ToolCallLog[]>;
    findById(tenantId: TenantId, incidentId: IncidentId, toolCallId: ToolCallId): Promise<ToolCallLog | null>;
}
