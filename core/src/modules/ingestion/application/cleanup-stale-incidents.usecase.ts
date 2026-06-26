import { logger } from '../../../shared/infra/logger.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface CleanupStaleIncidentsInput {
    tenantIds: TenantId[];
}

export interface CleanupResult {
    closed: number;
    errors: number;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
export class CleanupStaleIncidentsUseCase {
    incidentRepo;
    constructor(incidentRepo: IIncidentRepository) {
        this.incidentRepo = incidentRepo;
    }
    async execute(input: CleanupStaleIncidentsInput): Promise<CleanupResult> {
        let closed = 0;
        let errors = 0;
        const now = Date.now();
        for (const tenantId of input.tenantIds) {
            try {
                const { items } = await this.incidentRepo.listByTenant(tenantId, { limit: 100 });
                for (const incident of items) {
                    if (incident.status !== 'triaging' && incident.status !== 'investigating') {
                        continue;
                    }
                    const updatedAt = new Date(incident.updatedAt).getTime();
                    if (now - updatedAt < STALE_THRESHOLD_MS) {
                        continue;
                    }
                    try {
                        await this.incidentRepo.updateStatus(tenantId, incident.incidentId, 'closed');
                        closed++;
                        logger.info({ tenantId, incidentId: incident.incidentId, status: incident.status }, 'Closed stale incident');
                    }
                    catch (err) {
                        errors++;
                        logger.error({ err, tenantId, incidentId: incident.incidentId }, 'Failed to close stale incident');
                    }
                }
            }
            catch (err) {
                errors++;
                logger.error({ err, tenantId }, 'Failed to list incidents for cleanup');
            }
        }
        return { closed, errors };
    }
}
