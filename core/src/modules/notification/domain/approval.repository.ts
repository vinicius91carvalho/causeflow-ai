import type { TenantId, ApprovalId } from '../../../shared/domain/value-objects.js';
import type { PendingApproval } from './approval.entity.js';
export interface IApprovalRepository {
    create(approval: PendingApproval): Promise<PendingApproval>;
    findById(tenantId: TenantId, approvalId: ApprovalId): Promise<PendingApproval | null>;
    findPendingByTenant(tenantId: TenantId): Promise<PendingApproval[]>;
    update(tenantId: TenantId, approvalId: ApprovalId, updates: Partial<PendingApproval>): Promise<PendingApproval>;
}
