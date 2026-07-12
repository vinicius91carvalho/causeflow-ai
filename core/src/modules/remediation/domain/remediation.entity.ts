import type { RemediationId, TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
export type RemediationStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';
export type RemediationStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'succeeded'
  | 'failed'
  | 'skipped';
export interface PullRequestInfo {
  repoFullName: string;
  prNumber: number;
  prUrl: string;
  branch: string;
  status: 'open' | 'merged' | 'closed';
}
export interface RemediationStep {
  stepIndex: number;
  action: string;
  label: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  automated: boolean;
  params: Record<string, unknown>;
  status: RemediationStepStatus;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  output?: string;
  costUsd?: number;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
}
export interface Remediation {
  remediationId: RemediationId;
  tenantId: TenantId;
  incidentId: IncidentId;
  rollbackOf?: RemediationId;
  status: RemediationStatus;
  description: string;
  rootCause: string;
  steps: RemediationStep[];
  proposedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  pullRequests?: PullRequestInfo[];
  totalCostUsd?: number;
  totalDurationMs?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
