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

export class GetIncidentAnalyticsUseCase {
    incidentRepo;
    constructor(incidentRepo: IIncidentRepository) {
        this.incidentRepo = incidentRepo;
    }
    async execute(tenantId: TenantId): Promise<IncidentAnalytics> {
        const incidents = await this.incidentRepo.findAll(tenantId);
        const byStatus: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        let openCount = 0;
        let totalResolutionMs = 0;
        let resolvedCount = 0;
        let totalCostUsd = 0;
        let costCount = 0;
        for (const incident of incidents) {
            byStatus[incident.status] = (byStatus[incident.status] ?? 0) + 1;
            bySeverity[incident.severity] = (bySeverity[incident.severity] ?? 0) + 1;
            if (incident.status === 'open' || incident.status === 'triaging' || incident.status === 'investigating') {
                openCount++;
            }
            if (incident.totalCostUsd != null) {
                totalCostUsd += incident.totalCostUsd;
                costCount++;
            }
            if (incident.status === 'resolved' && incident.resolvedAt && incident.createdAt) {
                const created = new Date(incident.createdAt).getTime();
                const resolved = new Date(incident.resolvedAt).getTime();
                if (resolved > created) {
                    totalResolutionMs += resolved - created;
                    resolvedCount++;
                }
            }
        }
        return {
            total: incidents.length,
            byStatus,
            bySeverity,
            mttrMinutes: resolvedCount > 0 ? Math.round(totalResolutionMs / resolvedCount / 60000) : null,
            openCount,
            totalCostUsd,
            avgCostUsd: costCount > 0 ? totalCostUsd / costCount : null,
        };
    }
}
