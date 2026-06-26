import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { IApprovalRepository } from '../domain/approval.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { PendingApproval } from '../domain/approval.entity.js';
import type { TenantId, ApprovalId } from '../../../shared/domain/value-objects.js';

export interface RespondApprovalInput {
    tenantId: TenantId;
    approvalId: ApprovalId;
    action: string;
    respondedBy: string;
}

export interface ApprovalCallbacks {
    onApprove?: (approval: PendingApproval) => Promise<void>;
    onReject?: (approval: PendingApproval) => Promise<void>;
}

export class RespondApprovalUseCase {
    approvalRepo;
    eventBus;
    callbacks;
    constructor(approvalRepo: IApprovalRepository, eventBus: IEventBus, callbacks?: ApprovalCallbacks) {
        this.approvalRepo = approvalRepo;
        this.eventBus = eventBus;
        this.callbacks = callbacks;
    }
    async execute(input: RespondApprovalInput): Promise<PendingApproval> {
        const approval = await this.approvalRepo.findById(input.tenantId, input.approvalId);
        if (!approval) {
            throw new NotFoundError('Approval', input.approvalId);
        }
        if (approval.status !== 'pending') {
            throw new ValidationError(`Approval already ${approval.status}`);
        }
        if (new Date(approval.expiresAt) < new Date()) {
            throw new ValidationError('Approval has expired');
        }
        const validActions = approval.actions.map((a) => a.value);
        if (!validActions.includes(input.action)) {
            throw new ValidationError(`Invalid action: ${input.action}. Valid: ${validActions.join(', ')}`);
        }
        const isApproval = input.action === 'approve';
        const now = new Date().toISOString();
        const updated = await this.approvalRepo.update(input.tenantId, input.approvalId, {
            status: isApproval ? 'approved' : 'rejected',
            respondedBy: input.respondedBy,
            selectedAction: input.action,
            updatedAt: now,
        });
        // Trigger downstream action
        if (isApproval && this.callbacks?.onApprove) {
            await this.callbacks.onApprove(updated);
        }
        else if (!isApproval && this.callbacks?.onReject) {
            await this.callbacks.onReject(updated);
        }
        await this.eventBus.publish({
            eventType: 'notification.approval_responded',
            occurredAt: now,
            tenantId: input.tenantId,
            payload: {
                approvalId: input.approvalId,
                remediationId: approval.remediationId,
                action: input.action,
                respondedBy: input.respondedBy,
            },
        });
        return updated;
    }
}
