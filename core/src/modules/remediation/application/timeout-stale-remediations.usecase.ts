import { logger } from '../../../shared/infra/logger.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';

export interface TimeoutStaleRemediationsInput {
    tenantIds: TenantId[];
    incidentIds: IncidentId[];
}

export interface TimeoutResult {
    rejected: number;
    errors: number;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
export class TimeoutStaleRemediationsUseCase {
    remediationRepo;
    incidentRepo;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository) {
        this.remediationRepo = remediationRepo;
        this.incidentRepo = incidentRepo;
    }
    async execute(input: TimeoutStaleRemediationsInput): Promise<TimeoutResult> {
        let rejected = 0;
        let errors = 0;
        const now = Date.now();
        for (let i = 0; i < input.tenantIds.length; i++) {
            const tenantId = input.tenantIds[i]!;
            const incidentId = input.incidentIds[i]!;
            try {
                const remediations = await this.remediationRepo.findByIncident(tenantId, incidentId);
                for (const remediation of remediations) {
                    if (remediation.status !== 'proposed') {
                        continue;
                    }
                    const createdAt = new Date(remediation.createdAt).getTime();
                    if (now - createdAt < STALE_THRESHOLD_MS) {
                        continue;
                    }
                    try {
                        await this.remediationRepo.update(tenantId, remediation.remediationId, {
                            status: 'rejected',
                            rejectedBy: 'system-timeout',
                            rejectionReason: 'Auto-rejected: proposal timed out after 24h',
                        });
                        // Transition incident back to investigating
                        await this.incidentRepo.updateStatus(tenantId, incidentId, 'investigating');
                        rejected++;
                        logger.info({ tenantId, remediationId: remediation.remediationId, incidentId }, 'Timed out stale remediation proposal');
                    }
                    catch (err) {
                        errors++;
                        logger.error({ err, tenantId, remediationId: remediation.remediationId }, 'Failed to timeout stale remediation');
                    }
                }
            }
            catch (err) {
                errors++;
                logger.error({ err, tenantId, incidentId }, 'Failed to list remediations for timeout');
            }
        }
        return { rejected, errors };
    }
}
