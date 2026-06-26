import { ApprovalEntity } from '../../../shared/infra/db/entities/ApprovalEntity.js';
import { approvalId } from '../../../shared/domain/value-objects.js';
import type { IApprovalRepository } from '../domain/approval.repository.js';
import type { PendingApproval } from '../domain/approval.entity.js';
import type { ApprovalId, TenantId } from '../../../shared/domain/value-objects.js';
export class DynamoApprovalRepository {
    async create(approval: PendingApproval): Promise<PendingApproval> {
        const result = await ApprovalEntity.create({
            tenantId: approval.tenantId,
            approvalId: approval.approvalId,
            notificationId: approval.notificationId,
            incidentId: approval.incidentId ?? '',
            remediationId: approval.remediationId ?? '',
            title: approval.title,
            description: approval.description,
            actions: approval.actions,
            status: approval.status,
            timeoutMinutes: approval.timeoutMinutes,
            expiresAt: approval.expiresAt,
        }).go();
        return this.toDomain(result.data);
    }
    async findById(tenantId: TenantId, aid: ApprovalId): Promise<PendingApproval | null> {
        const result = await ApprovalEntity.get({ tenantId, approvalId: aid }).go();
        if (!result.data)
            return null;
        return this.toDomain(result.data);
    }
    async findPendingByTenant(tenantId: TenantId): Promise<PendingApproval[]> {
        const result = await ApprovalEntity.query.byStatus({ tenantId, status: 'pending' }).go();
        return result.data.map((d) => this.toDomain(d));
    }
    async update(tenantId: TenantId, aid: ApprovalId, updates: Partial<PendingApproval>): Promise<PendingApproval> {
        const result = await ApprovalEntity.patch({ tenantId, approvalId: aid })
            .set({
            ...(updates.status && { status: updates.status }),
            ...(updates.respondedBy && { respondedBy: updates.respondedBy }),
            ...(updates.selectedAction && { selectedAction: updates.selectedAction }),
        })
            .go({ response: 'all_new' });
        return this.toDomain(result.data);
    }
    toDomain(data: Record<string, any>) {
        return {
            approvalId: approvalId(data.approvalId),
            tenantId: data.tenantId,
            notificationId: data.notificationId,
            incidentId: data.incidentId,
            remediationId: data.remediationId,
            title: data.title,
            description: data.description,
            actions: data.actions ?? [],
            status: data.status,
            respondedBy: data.respondedBy,
            selectedAction: data.selectedAction,
            timeoutMinutes: data.timeoutMinutes,
            expiresAt: data.expiresAt,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        };
    }
}
