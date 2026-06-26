import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { Severity, IncidentStatus } from '../../../shared/domain/types.js';
export type KnownSolutionStatus = 'pending' | 'accepted' | 'declined';
export interface CustomerExplanation {
    summary: string;
    impact: string;
    resolution: string;
    eta?: string;
}
export interface Incident {
    incidentId: IncidentId;
    tenantId: TenantId;
    title: string;
    description: string;
    severity: Severity;
    status: IncidentStatus;
    sourceProvider: string;
    sourceAlertId: string;
    assignedAgents?: string[];
    rootCause?: string;
    recommendedActions?: Array<{
        action: string;
        params: Record<string, unknown>;
    }>;
    knownSolutionPatternId?: string;
    knownSolutionStatus?: KnownSolutionStatus;
    customerExplanation?: CustomerExplanation;
    totalCostUsd?: number;
    costBreakdown?: {
        subAgents: number;
        synthesis: number;
        codeFixer: number;
        wave1?: number;
        wave2?: number;
    };
    investigationDurationMs?: number;
    resolution?: string;
    resolvedAt?: string;
    createdAt: string;
    updatedAt: string;
}
