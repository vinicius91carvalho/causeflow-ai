import type { IApprovalRepository } from '../domain/approval.repository.js';
import type { PendingApproval } from '../domain/approval.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface ListPendingApprovalsInput {
    tenantId: TenantId;
}

export class ListPendingApprovalsUseCase {
    approvalRepo;
    constructor(approvalRepo: IApprovalRepository) {
        this.approvalRepo = approvalRepo;
    }
    async execute(input: ListPendingApprovalsInput): Promise<PendingApproval[]> {
        const approvals = await this.approvalRepo.findPendingByTenant(input.tenantId);
        const now = new Date().toISOString();
        return approvals.filter((a) => a.expiresAt > now);
    }
}
