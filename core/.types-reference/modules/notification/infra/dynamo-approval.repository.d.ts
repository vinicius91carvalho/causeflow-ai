import type { IApprovalRepository } from '../domain/approval.repository.js';
import type { PendingApproval } from '../domain/approval.entity.js';
import type { TenantId, ApprovalId } from '../../../shared/domain/value-objects.js';
export declare class DynamoApprovalRepository implements IApprovalRepository {
    create(approval: PendingApproval): Promise<PendingApproval>;
    findById(tenantId: TenantId, aid: ApprovalId): Promise<PendingApproval | null>;
    findPendingByTenant(tenantId: TenantId): Promise<PendingApproval[]>;
    update(tenantId: TenantId, aid: ApprovalId, updates: Partial<PendingApproval>): Promise<PendingApproval>;
    private toDomain;
}
