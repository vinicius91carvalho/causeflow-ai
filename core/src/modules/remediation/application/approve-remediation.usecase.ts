import { NotFoundError } from '../../../shared/domain/errors.js';
import { RemediationNotProposedError } from '../domain/remediation.errors.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, RemediationId } from '../../../shared/domain/value-objects.js';

export interface ApproveRemediationInput {
    tenantId: TenantId;
    remediationId: RemediationId;
    approvedBy: string;
}

export class ApproveRemediationUseCase {
    remediationRepo;
    eventBus;
    constructor(remediationRepo: IRemediationRepository, eventBus: IEventBus) {
        this.remediationRepo = remediationRepo;
        this.eventBus = eventBus;
    }
    async execute(input: ApproveRemediationInput): Promise<Remediation> {
        const { tenantId, remediationId, approvedBy } = input;
        // 1. Fetch remediation
        const remediation = await this.remediationRepo.findById(tenantId, remediationId);
        if (!remediation) {
            throw new NotFoundError('Remediation', remediationId);
        }
        // 2. Validate status
        if (remediation.status !== 'proposed') {
            throw new RemediationNotProposedError(remediationId, remediation.status);
        }
        // 3. Update status to approved
        const updated = await this.remediationRepo.update(tenantId, remediationId, {
            status: 'approved',
            approvedBy,
        });
        // 4. Publish event
        await this.eventBus.publish({
            eventType: 'remediation.approved',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId: remediation.incidentId,
                remediationId,
                approvedBy,
            },
        });
        return updated;
    }
}
