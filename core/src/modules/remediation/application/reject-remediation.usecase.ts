import { NotFoundError } from '../../../shared/domain/errors.js';
import { RemediationNotProposedError } from '../domain/remediation.errors.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, RemediationId } from '../../../shared/domain/value-objects.js';

export interface RejectRemediationInput {
    tenantId: TenantId;
    remediationId: RemediationId;
    rejectedBy: string;
    reason?: string;
}

export class RejectRemediationUseCase {
    remediationRepo;
    incidentRepo;
    eventBus;
    constructor(remediationRepo: IRemediationRepository, incidentRepo: IIncidentRepository, eventBus: IEventBus) {
        this.remediationRepo = remediationRepo;
        this.incidentRepo = incidentRepo;
        this.eventBus = eventBus;
    }
    async execute(input: RejectRemediationInput): Promise<Remediation> {
        const { tenantId, remediationId, rejectedBy, reason } = input;
        // 1. Fetch remediation
        const remediation = await this.remediationRepo.findById(tenantId, remediationId);
        if (!remediation) {
            throw new NotFoundError('Remediation', remediationId);
        }
        // 2. Validate status
        if (remediation.status !== 'proposed') {
            throw new RemediationNotProposedError(remediationId, remediation.status);
        }
        // 3. Update remediation to rejected
        const updated = await this.remediationRepo.update(tenantId, remediationId, {
            status: 'rejected',
            rejectedBy,
            rejectionReason: reason,
        });
        // 4. Transition incident back to investigating
        await this.incidentRepo.updateStatus(tenantId, remediation.incidentId, 'investigating');
        // 5. Publish event
        await this.eventBus.publish({
            eventType: 'remediation.rejected',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId: remediation.incidentId,
                remediationId,
                rejectedBy,
                reason: reason ?? '',
            },
        });
        return updated;
    }
}
