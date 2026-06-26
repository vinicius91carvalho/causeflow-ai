import type { TenantId, ApprovalId, NotificationId, IncidentId, RemediationId } from '../../../shared/domain/value-objects.js';
import type { ApprovalStatus } from '../../../shared/domain/types.js';
export interface ApprovalAction {
    label: string;
    value: string;
    style?: 'primary' | 'danger';
}
export interface PendingApproval {
    approvalId: ApprovalId;
    tenantId: TenantId;
    notificationId: NotificationId;
    incidentId: IncidentId;
    remediationId: RemediationId;
    title: string;
    description: string;
    actions: ApprovalAction[];
    status: ApprovalStatus;
    respondedBy?: string;
    selectedAction?: string;
    timeoutMinutes: number;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
}
