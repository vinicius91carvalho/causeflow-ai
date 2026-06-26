/**
 * Approvals domain types.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Approval {
  tenantId: string;
  approvalId: string;
  notificationId: string;
  incidentId?: string;
  remediationId?: string;
  title: string;
  description: string;
  actions: string[];
  status: ApprovalStatus;
  respondedBy?: string;
  selectedAction?: string;
  timeoutMinutes: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}
