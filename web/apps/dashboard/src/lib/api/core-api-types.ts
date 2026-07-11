// Pagination wrapper matching the Core API contract
export interface PaginatedResponse<T> {
  items: T[];
  cursor?: string;
}

// Query params for list endpoints
export interface ListIncidentsParams {
  limit?: number;
  cursor?: string;
  severity?: string;
  status?: string;
  sort?: string;
}

export interface ListAuditParams {
  action?: string;
  actorType?: 'user' | 'system';
  limit?: number;
  cursor?: string;
}

export interface ListRemediationsParams {
  incidentId: string;
}

export interface ListNotificationsParams {
  cursor?: string;
  limit?: number;
}

// Create/Update request bodies
export interface CreateRemediationInput {
  incidentId: string;
  rootCause: string;
  recommendedActions: Array<{ action: string; params?: Record<string, unknown> }>;
}

export interface UpdateIncidentInput {
  status: string;
}

export interface UpdateTenantSettingsInput {
  name?: string;
  settings?: {
    autoRemediation?: boolean;
    notificationChannels?: string[];
  };
}

export interface ApprovalRespondInput {
  action: string;
  respondedBy: string;
}

// Tenant from API (extends our local understanding)
export interface ApiTenant {
  tenantId: string;
  name: string;
  slug: string;
  ownerEmail: string;
  plan: string;
  status: string;
  settings: {
    maxIncidentsPerMonth: number;
    autoRemediation: boolean;
    notificationChannels: string[];
    chatProvider: string;
  };
  createdAt: string;
}

// Analytics response shapes
//
// IncidentAnalytics is the dashboard-side canonical contract. Consumers MUST
// read this via HttpApiClient.getIncidentAnalytics(), NOT by calling
// request('/v1/analytics/incidents') directly — the Core wire shape uses
// different field names and is remapped inside http-api-client.ts. See
// INVARIANTS.md in the dashboard-redesign-core-api PRD and PRD §8 for the
// full contract and the canonical remap function.
export interface IncidentAnalytics {
  totalIncidents: number;
  openIncidents: number;
  mttr: number; // minutes; 0 when Core reports no resolved incidents
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  totalCostUsd: number;
  avgCostUsd: number | null;
}

// Notification from API
export interface ApiNotification {
  notificationId: string;
  tenantId: string;
  type: string;
  read: boolean;
  createdAt: string;
}

// Pending approval from notifications endpoint
export interface PendingApproval {
  approvalId: string;
  notificationId: string;
  incidentId: string;
  remediationId: string;
  title: string;
  description: string;
  actions: unknown;
  status: string;
  timeoutMinutes: number;
  expiresAt: string;
  createdAt: string;
}

// Audit verification result
export interface AuditVerification {
  valid: boolean;
  totalEntries: number;
  brokenAt: string | null;
}

// Auth me response
export interface AuthUser {
  tenantId: string;
  userId: string;
  email: string;
  roles: string[];
}

// Health check responses
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  timestamp: string;
}

export interface HealthDependency {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  message?: string;
}

export interface HealthDetailedStatus extends HealthStatus {
  dependencies: HealthDependency[];
}

// Tenant creation
export interface CreateTenantInput {
  name: string;
  slug: string;
  ownerEmail: string;
}

// API Keys
export interface CreateApiKeyInput {
  name: string;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
}

export interface ListApiKeysResponse {
  keys: ApiKey[];
}

// Knowledge Feedback
export type FeedbackType =
  | 'investigation_accurate'
  | 'investigation_inaccurate'
  | 'investigation_partial';

export interface SubmitFeedbackInput {
  incidentId: string;
  type: FeedbackType;
  freeText?: string;
}

export interface FeedbackItem {
  id: string;
  incidentId: string;
  type: FeedbackType;
  comment?: string;
  actor: string;
  createdAt: string;
}

export interface ListFeedbackResponse {
  feedback: FeedbackItem[];
}

// Investigation Detail (evidence grouped by agent)
export interface InvestigationEvidence {
  evidenceId: string;
  agentRole: string;
  evidenceType: string;
  content: string;
  toolCallId?: string;
  claim?: string;
  quote?: string;
  metadata?: {
    source?: string;
    /** Present on Ornith / OpenAI-compatible completion evidence (AC-057). */
    llmModel?: string;
    llmConnector?: string;
    phase?: string;
    timeRange?: string;
    confidence?: number;
    category?: string;
    toolName?: string;
    label?: string;
  };
  createdAt: string;
}

export interface InvestigationDetail {
  incident: import('@/contexts/investigation/domain/types').Incident;
  evidenceByAgent: Record<string, InvestigationEvidence[]>;
}

/**
 * Raw record of a single tool call made during an investigation. Served by
 * `GET /v1/investigation/:incidentId/tool-calls/:toolCallId` for evidence
 * drill-down — the dashboard uses this to render the exact I/O that
 * produced a cited piece of evidence.
 */
export interface ToolCallDetail {
  tenantId: string;
  incidentId: string;
  toolCallId: string;
  agentRole: string;
  name: string;
  origin: 'real' | 'synthetic_memory';
  input: Record<string, unknown>;
  output: string;
  success: boolean;
  metadata?: {
    provider?: string;
    label?: string;
  };
  createdAt: string;
}

// Pattern Analytics
export interface PatternCategory {
  category: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ConfidenceRange {
  range: string;
  count: number;
}

export interface ResolutionRates {
  automated: number;
  manual: number;
  pending: number;
}

export interface PatternAnalytics {
  topCategories: PatternCategory[];
  confidenceDistribution: ConfidenceRange[];
  resolutionRates: ResolutionRates;
  totalPatterns: number;
  avgConfidence: number;
}

// Service Graph / Topology
export interface ServiceNode {
  serviceId: string;
  tenantId: string;
  name: string;
  type:
    | 'api'
    | 'database'
    | 'cache'
    | 'queue'
    | 'storage'
    | 'cdn'
    | 'load_balancer'
    | 'function'
    | 'container'
    | 'other';
  runtime?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  healthDetails?: string;
  blastRadius?: number;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  ownerTeam?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ServiceEdge {
  edgeId: string;
  sourceService: string;
  targetService: string;
  edgeType: 'http' | 'grpc' | 'tcp' | 'event' | 'database' | 'cache' | 'queue';
  protocol?: string;
  traffic?: {
    requestsPerSecond?: number;
    avgLatencyMs?: number;
    errorRate?: number;
  };
  isCriticalPath: boolean;
}

export interface SystemHealthSummary {
  totalServices: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
}

export interface BlastRadiusResult {
  sourceService: string;
  affectedServices: { serviceId: string; name: string; impact: 'direct' | 'indirect' }[];
  totalAffected: number;
  maxDepth: number;
}

// Team
export interface TeamMember {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  profileComplete: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface ListTeamMembersParams {
  cursor?: string;
}

export interface ListTeamMembersResponse {
  members: TeamMember[];
  pagination: { cursor: string | null };
}

// Invites
export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface TeamInvite {
  tenantId: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string;
  expiresAt: string;
  status: InviteStatus;
  createdAt: string;
}

export interface CreateInviteInput {
  email: string;
  role: 'admin' | 'member';
}

export interface ChangeRoleInput {
  role: 'admin' | 'member';
}

// Slack integration config
export interface SlackConfigResponse {
  connected: boolean;
  /** Notification channel, e.g. #incidents */
  channel?: string;
  /** Slack workspace display name */
  workspaceName?: string;
  /** ISO 8601 timestamp of when the app was installed */
  installedAt?: string;
}

export interface SlackConfigUpdateInput {
  /** Must match ^#[a-z0-9_-]{1,79}$ */
  channel: string;
}
