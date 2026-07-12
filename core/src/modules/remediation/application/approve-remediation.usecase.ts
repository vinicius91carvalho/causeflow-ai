import { randomUUID } from 'node:crypto';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation } from '../domain/remediation.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId, RemediationId } from '../../../shared/domain/value-objects.js';
import { approvalId, notificationId } from '../../../shared/domain/value-objects.js';
import type { IApprovalRepository } from '../../notification/domain/approval.repository.js';

export interface ApproveRemediationInput {
  tenantId: TenantId;
  remediationId: RemediationId;
  approvedBy: string;
}

export class ApproveRemediationUseCase {
  remediationRepo;
  eventBus;
  approvalRepo: IApprovalRepository | null;
  constructor(
    remediationRepo: IRemediationRepository,
    eventBus: IEventBus,
    approvalRepo?: IApprovalRepository,
  ) {
    this.remediationRepo = remediationRepo;
    this.eventBus = eventBus;
    this.approvalRepo = approvalRepo ?? null;
  }
  async execute(input: ApproveRemediationInput): Promise<Remediation> {
    const { tenantId, remediationId, approvedBy } = input;
    // 1. Fetch remediation
    const remediation = await this.remediationRepo.findById(tenantId, remediationId);
    if (!remediation) {
      throw new NotFoundError('Remediation', remediationId);
    }
    // 2. Validate status — 409 if already approved
    if (remediation.status === 'approved') {
      throw new ConflictError(`Remediation ${remediationId} is already approved`);
    }
    if (remediation.status !== 'proposed') {
      throw new ConflictError(
        `Remediation ${remediationId} cannot be approved: status is '${remediation.status}'`,
      );
    }
    // 3. Create ApprovalEntity (AC-023)
    if (this.approvalRepo) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
      await this.approvalRepo.create({
        approvalId: approvalId(`apr_${randomUUID()}`),
        tenantId,
        notificationId: notificationId(`notif_${randomUUID()}`),
        incidentId: remediation.incidentId,
        remediationId,
        title: `Remediation approval: ${remediation.description.slice(0, 80)}`,
        description: remediation.description,
        actions: [{ label: 'Approve', value: 'approve', style: 'primary' }],
        status: 'approved',
        respondedBy: approvedBy,
        selectedAction: 'approve',
        timeoutMinutes: 30,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }
    // 4. Update status to approved
    const updated = await this.remediationRepo.update(tenantId, remediationId, {
      status: 'approved',
      approvedBy,
    });
    // 5. Publish event
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
