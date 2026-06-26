/**
 * Investigation domain types.
 *
 * Covers Incidents, Remediations, and legacy Analysis types (kept for
 * backward compatibility during migration to Incident-centric model).
 */

// ---------------------------------------------------------------------------
// Incident types
// ---------------------------------------------------------------------------

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export const INCIDENT_STATUSES = [
  'open',
  'triaging',
  'investigating',
  'awaiting_approval',
  'remediating',
  'resolved',
  'closed',
  'inconclusive',
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export type KnownSolutionStatus = 'none' | 'pending' | 'accepted' | 'declined';

export interface KnownSolution {
  rootCause: string;
  recommendedFix: string;
  confidence: number;
}

export type InvestigationModeName = 'orchestrator' | 'hypothesis' | 'debate';

export type HypothesisStatus = 'pending' | 'confirmed' | 'rejected';

export type HypothesisEvidenceSourcedBy =
  | 'seeker'
  | 'validator'
  | 'advocate'
  | 'prosecutor'
  | 'judge';

export interface HypothesisEvidenceRef {
  evidenceId: string;
  sourcedBy: HypothesisEvidenceSourcedBy;
  summary: string;
  /** Signed weight in [-1, 1]. Positive supports, negative undermines. */
  weight: number;
  toolName?: string;
  observedAt?: string;
}

export interface Hypothesis {
  hypothesisId: string;
  tenantId: string;
  incidentId: string;
  statement: string;
  rationale?: string;
  /** Provenance tags: `pattern:<id>`, `memory:<ref>`, `integration:<provider>:<ref>`, `observation:<desc>`, `llm:prior`. */
  informedBy?: string[];
  /** Running confidence in [0, 1]. */
  confidence: number;
  evidenceFor: HypothesisEvidenceRef[];
  evidenceAgainst: HypothesisEvidenceRef[];
  status: HypothesisStatus;
  /** Final 0-100 score assigned by the judge. Undefined until judge runs. */
  finalScore?: number;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  tenantId: string;
  incidentId: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  sourceProvider: string;
  sourceAlertId?: string;
  assignedAgents?: string[];
  rootCause?: string;
  resolution?: string;
  resolvedAt?: string;
  knownSolutionStatus?: KnownSolutionStatus;
  knownSolution?: KnownSolution;
  /** Reasoning strategy used for this investigation. Absent = orchestrator (default). */
  investigationMode?: InvestigationModeName;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Remediation types
// ---------------------------------------------------------------------------

export type RemediationStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';
export type RemediationStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type PullRequestStatus = 'open' | 'merged' | 'closed';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RemediationStep {
  stepIndex: number;
  action: string;
  label?: string;
  description?: string;
  riskLevel?: RiskLevel;
  automated?: boolean;
  params?: unknown;
  status: RemediationStepStatus;
  output?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RemediationPullRequest {
  repoFullName: string;
  prNumber: number;
  prUrl: string;
  branch: string;
  status: PullRequestStatus;
}

export interface Remediation {
  tenantId: string;
  remediationId: string;
  incidentId: string;
  status: RemediationStatus;
  description: string;
  rootCause: string;
  steps?: RemediationStep[];
  pullRequests?: RemediationPullRequest[];
  proposedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Legacy Analysis types — kept for backward compatibility during migration.
// Analysis-based API routes and components will be migrated to Incident types.
// @deprecated — will be removed after full migration to Incident types.
// ---------------------------------------------------------------------------

/** @deprecated Use IncidentStatus instead */
export type AnalysisStatus = 'queued' | 'running' | 'completed' | 'failed';

/** @deprecated Use IncidentSeverity instead */
export type AnalysisSeverity = 'low' | 'medium' | 'high' | 'critical';

/** @deprecated Part of the legacy Analysis entity */
export interface AnalysisDataSource {
  type: string;
  name: string;
  recordsIngested?: number;
}

/** @deprecated Part of the legacy Analysis entity */
export interface AnalysisAuditEvent {
  timestamp: string;
  action: string;
  actor?: string;
}

/** @deprecated Use Incident instead */
export interface Analysis {
  id: string;
  tenantId: string;
  prompt: string;
  status: AnalysisStatus;
  severity?: AnalysisSeverity;
  result?: string;
  confidence?: number;
  timeline?: string;
  recommendations?: string[];
  dataSources?: AnalysisDataSource[];
  auditTrail?: AnalysisAuditEvent[];
  createdAt: string;
  completedAt?: string;
}
