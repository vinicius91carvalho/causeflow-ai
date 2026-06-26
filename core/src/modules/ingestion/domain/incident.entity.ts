import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { Severity, IncidentStatus } from '../../../shared/domain/types.js';
export type KnownSolutionStatus = 'pending' | 'accepted' | 'declined';
export type InvestigationMode = 'orchestrator' | 'hypothesis' | 'debate';
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
        // Wave mode
        subAgents?: number;
        wave0?: number;
        wave1?: number;
        wave2?: number;
        wave3?: number;
        // Orchestrator mode
        orchestrator?: number;
        verification?: number;
        // Shared
        synthesis: number;
        codeFixer: number;
    };
    investigationDurationMs?: number;
    /**
     * Reasoning strategy used for this investigation. Stamped by staff-only
     * admin endpoint; defaults to orchestrator when omitted.
     */
    investigationMode?: InvestigationMode;
    /**
     * Optional secondary mode run in parallel for comparison. Result is not
     * shown to the tenant; used for internal A/B validation of new modes.
     */
    shadowInvestigationMode?: InvestigationMode;
    resolution?: string;
    resolvedAt?: string;
    /** Slack message timestamp for the initial alert notification — used to thread resolution replies. */
    slackNotificationTs?: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Strips platform-internal accounting fields from an Incident before
 * returning it on any tenant-facing HTTP response. Cost and duration
 * are internal and must never leak to customers.
 */
export function sanitizeIncidentForTenant<T extends Partial<Incident>>(incident: T): Omit<T, 'totalCostUsd' | 'costBreakdown' | 'investigationDurationMs' | 'shadowInvestigationMode'> {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
        totalCostUsd: _cost,
        costBreakdown: _breakdown,
        investigationDurationMs: _duration,
        shadowInvestigationMode: _shadowMode,
        ...safe
    } = incident;
    /* eslint-enable @typescript-eslint/no-unused-vars */
    return safe;
}
