import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface IncidentAnalytics {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    mttrMinutes: number | null;
    openCount: number;
    totalCostUsd: number;
    avgCostUsd: number | null;
}
export declare class GetIncidentAnalyticsUseCase {
    private readonly incidentRepo;
    constructor(incidentRepo: IIncidentRepository);
    execute(tenantId: TenantId): Promise<IncidentAnalytics>;
}
