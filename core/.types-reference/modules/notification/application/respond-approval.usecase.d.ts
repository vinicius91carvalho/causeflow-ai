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
export declare class RespondApprovalUseCase {
    private readonly approvalRepo;
    private readonly eventBus;
    private readonly callbacks?;
    constructor(approvalRepo: IApprovalRepository, eventBus: IEventBus, callbacks?: ApprovalCallbacks | undefined);
    execute(input: RespondApprovalInput): Promise<PendingApproval>;
}
