import type { IApprovalRepository } from '../domain/approval.repository.js';
import type { PendingApproval } from '../domain/approval.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface ListPendingApprovalsInput {
    tenantId: TenantId;
}
export declare class ListPendingApprovalsUseCase {
    private readonly approvalRepo;
    constructor(approvalRepo: IApprovalRepository);
    execute(input: ListPendingApprovalsInput): Promise<PendingApproval[]>;
}
