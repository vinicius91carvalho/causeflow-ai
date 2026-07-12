import type { AuditEntry } from '@/contexts/audit/domain/types';
import type { Incident, Remediation } from '@/contexts/investigation/domain/types';
import type {
  Locale,
  NotificationSettings,
  Theme,
  UserSettings,
} from '@/contexts/settings/domain/types';
import type {
  ApiNotification,
  ApiTenant,
  ApprovalRespondInput,
  AuditVerification,
  AuthUser,
  BlastRadiusResult,
  ChangeRoleInput,
  CreateApiKeyInput,
  CreatedApiKey,
  CreateInviteInput,
  CreateRemediationInput,
  CreateTenantInput,
  FeedbackItem,
  HealthDetailedStatus,
  HealthStatus,
  IncidentAnalytics,
  InvestigationDetail,
  ListApiKeysResponse,
  ListAuditParams,
  ListFeedbackResponse,
  ListIncidentsParams,
  ListNotificationsParams,
  ListTeamMembersParams,
  ListTeamMembersResponse,
  PaginatedResponse,
  PatternAnalytics,
  PendingApproval,
  ServiceEdge,
  ServiceNode,
  SlackConfigResponse,
  SlackConfigUpdateInput,
  SubmitFeedbackInput,
  SystemHealthSummary,
  TeamInvite,
  ToolCallDetail,
  UpdateIncidentInput,
  UpdateTenantSettingsInput,
} from './core-api-types';

export interface ICoreApiClient {
  // Health
  healthCheck(): Promise<HealthStatus>;
  healthDetailed(): Promise<HealthDetailedStatus>;

  // Auth
  getMe(): Promise<AuthUser>;

  // Incidents
  listIncidents(params?: ListIncidentsParams): Promise<PaginatedResponse<Incident>>;
  getIncident(incidentId: string): Promise<Incident>;
  updateIncident(incidentId: string, input: UpdateIncidentInput): Promise<Incident>;

  getInvestigationDetail(incidentId: string): Promise<InvestigationDetail>;
  getToolCall(incidentId: string, toolCallId: string): Promise<ToolCallDetail>;

  // Remediations
  listRemediations(incidentId: string): Promise<Remediation[]>;
  getRemediation(remediationId: string): Promise<Remediation>;
  createRemediation(input: CreateRemediationInput): Promise<Remediation>;
  approveRemediation(remediationId: string): Promise<Remediation>;
  rejectRemediation(remediationId: string, reason?: string): Promise<Remediation>;
  executeRemediation(remediationId: string): Promise<Remediation>;

  // Audit
  listAuditEntries(params?: ListAuditParams): Promise<PaginatedResponse<AuditEntry>>;
  verifyAuditChain(): Promise<AuditVerification>;

  // Notifications & Approvals
  listNotifications(params?: ListNotificationsParams): Promise<PaginatedResponse<ApiNotification>>;
  getNotification(id: string): Promise<ApiNotification>;
  markNotificationRead(id: string): Promise<{ success: boolean }>;
  listPendingApprovals(): Promise<PendingApproval[]>;
  respondToApproval(approvalId: string, input: ApprovalRespondInput): Promise<unknown>;

  // Tenant
  getTenant(tenantId: string): Promise<ApiTenant>;
  updateTenant(tenantId: string, input: UpdateTenantSettingsInput): Promise<ApiTenant>;
  createTenant(input: CreateTenantInput): Promise<ApiTenant>;

  // API Keys
  createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey>;
  listApiKeys(): Promise<ListApiKeysResponse>;
  revokeApiKey(keyId: string): Promise<{ success: boolean }>;

  // Knowledge Feedback
  submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackItem>;
  listFeedback(incidentId: string): Promise<ListFeedbackResponse>;

  // Analytics
  getIncidentAnalytics(): Promise<IncidentAnalytics>;
  getPatternAnalytics(): Promise<PatternAnalytics>;

  // Service Graph / Topology
  listServiceNodes(params?: {
    type?: string;
    healthStatus?: string;
    ownerTeam?: string;
  }): Promise<ServiceNode[]>;
  getServiceNode(serviceId: string): Promise<ServiceNode>;
  listServiceEdges(params?: {
    sourceService?: string;
    targetService?: string;
  }): Promise<ServiceEdge[]>;
  getSystemHealth(): Promise<SystemHealthSummary>;
  getBlastRadius(serviceId: string, maxDepth?: number): Promise<BlastRadiusResult>;

  // Memory
  getMemoryInsights(): Promise<any>;
  getMemorySummary(): Promise<any>;
  askMemory(body: { question: string; context?: string }): Promise<any>;

  // Known solution
  respondKnownSolution(
    incidentId: string,
    body: { response: 'accepted' | 'declined' },
  ): Promise<any>;

  // Investigation feedback
  submitInvestigationFeedback(incidentId: string, body: any): Promise<any>;
  submitRemediationFeedback(remediationId: string, body: any): Promise<any>;
  abortInvestigation(incidentId: string): Promise<any>;

  // Investigation context/trigger
  addInvestigationContext(incidentId: string, body: any): Promise<any>;
  triggerInvestigation(incidentId: string): Promise<any>;
  triggerTriage(incidentId: string): Promise<any>;

  /**
   * Staff-only: stamp a specific reasoning mode on the incident and
   * trigger the investigation under that mode. Gated server-side by
   * @causeflow.ai email check (see staff.middleware.ts on the Core API).
   */
  adminRunInvestigation(
    incidentId: string,
    body: {
      mode: 'orchestrator' | 'hypothesis' | 'debate';
      shadowMode?: 'orchestrator' | 'hypothesis' | 'debate';
      suggestedAgents?: string[];
    },
  ): Promise<any>;

  /**
   * Lists hypotheses attached to an incident. Populated only when the
   * investigation ran under hypothesis or debate mode. Returns an empty
   * array for orchestrator-mode incidents.
   */
  listHypotheses(incidentId: string): Promise<any>;

  // GitHub
  setupGitHubApp(installationId: number, code: string): Promise<any>;
  getGitHubInstallation(): Promise<any>;
  revokeGitHubInstallation(): Promise<any>;

  // Integrations — catalog & list
  getIntegrationCatalog(): Promise<any>;
  listIntegrations(): Promise<any>;

  // Integrations — OAuth connect (Core stub may return empty in OSS — AC-051)
  initiateOAuthConnect(
    provider: string,
    redirectUrl: string,
  ): Promise<{ authUrl?: string }>;
  revokeOAuthConnection(provider: string): Promise<any>;

  // Integrations — OAuth callback finalization (server-side redirect flow)
  finalizeComposioConnection(
    provider: string,
    params: { connectedAccountId?: string },
  ): Promise<void>;

  // Integrations — AWS credentials
  connectCredential(provider: string, credentials: Record<string, unknown>): Promise<any>;
  disconnectCredential(type: string): Promise<any>;
  testIntegrationConnection(body: any): Promise<any>;

  /**
   * OSS stub upstream connector (AC-055 / Core AC-056).
   * POSTs to Core `POST /v1/integrations/stub/connect`, which registers the
   * tenant against the Core-owned test-app / stub-upstream (not Composio).
   */
  connectStubIntegration(body?: { baseUrl?: string; coreBaseUrl?: string }): Promise<{
    integrationId: string;
    provider: string;
    status: string;
    stubConnectionId: string;
    stubBaseUrl: string;
    connectedAt: string;
  }>;

  /**
   * OSS additional connector against the connected test app (AC-058).
   * POSTs to Core `POST /v1/integrations/stub/enable` (not Composio).
   */
  enableStubConnector(body: { provider: string }): Promise<{
    integrationId: string;
    provider: string;
    status: string;
    stubBaseUrl: string;
    linkedTo: string;
    connectedAt: string;
  }>;

  // Legacy aliases
  connectIntegration(body: { type: string; [key: string]: unknown }): Promise<any>;
  getOAuthAuthorizeUrl(provider: string): Promise<string>;
  storeOAuthToken(provider: string, body: any): Promise<any>;
  revokeOAuthIntegration(provider: string): Promise<any>;
  getOAuthStatus(): Promise<any>;
  getAwsSetupInfo(): Promise<any>;

  // Triggers
  listTriggers(): Promise<any[]>;
  createTrigger(body: import('@/contexts/integrations/domain/types').CreateTriggerInput): Promise<{
    trigger: import('@/contexts/integrations/domain/types').TriggerDto;
    webhookUrl?: string;
  }>;
  deleteTrigger(id: string): Promise<{ success: boolean }>;
  listAvailableTriggers(): Promise<any[]>;

  // Incidents — create
  createIncident(body: {
    title: string;
    description: string;
    severity?: string;
    investigationMode?: 'orchestrator' | 'hypothesis' | 'debate';
  }): Promise<any>;

  // Billing — plans & subscription
  getPlans(): Promise<any[]>;
  getSubscription(): Promise<any>;
  createCheckout(body: {
    planKey: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createPortalSession(body: { returnUrl: string }): Promise<{ url: string }>;
  createSubscription(body: {
    planId: string;
  }): Promise<{ subscriptionId: string; clientSecret: string; status: string }>;

  // Relay
  getRelayStatus(): Promise<any>;

  // Billing extras
  getCredits(): Promise<any>;
  getUsageHistory(days?: number): Promise<any>;
  getInvoices(limit?: number): Promise<any>;
  purchaseQuotaPack(body: {
    packType: 'investigations' | 'events';
    quantity: number;
  }): Promise<any>;

  // User extras
  getUserByEmail(email: string): Promise<any | null>;
  getUserProfile(userId: string): Promise<any | null>;

  // Beta
  checkBetaAllowlist(email: string): Promise<any>;
  recordTermsAcceptance(body: any): Promise<any>;

  // Team
  listTeamMembers(params?: ListTeamMembersParams): Promise<ListTeamMembersResponse>;
  removeTeamMember(userId: string): Promise<{ success: boolean }>;
  changeTeamMemberRole(
    userId: string,
    input: ChangeRoleInput,
  ): Promise<{ success: boolean; userId: string; role: string }>;

  // Invites
  createInvite(input: CreateInviteInput): Promise<{ invite: TeamInvite }>;
  listInvites(): Promise<{ invites: TeamInvite[] }>;
  revokeInvite(email: string): Promise<{ success: boolean }>;

  // Memory seeding
  seedMemoryContext(input: {
    source: 'business-profile';
    schemaVersion: string;
    markdown: string;
  }): Promise<{ memoryId?: string }>;

  // User settings
  getUserSettings(userId: string): Promise<UserSettings>;
  updateUserSettings(
    userId: string,
    input: { theme?: Theme; locale?: Locale; notifications?: NotificationSettings },
  ): Promise<UserSettings>;

  // Slack integration
  getSlackConfig(): Promise<SlackConfigResponse>;
  updateSlackConfig(input: SlackConfigUpdateInput): Promise<SlackConfigResponse>;
  deleteSlackOAuth(): Promise<void>;
  testSlackConnection(): Promise<{ ok: boolean; error?: string }>;

  // Sentry integration (AD-3, AD-4, AD-5)
  /**
   * POST /v1/integrations/sentry — save the Internal Integration Client Secret.
   * The secret is forwarded once via the Next.js BFF proxy and never persisted
   * client-side. Core extracts the tenantId from the Clerk JWT `org_id` claim.
   */
  saveSentryClientSecret(secret: string): Promise<{ hasClientSecret: true; verified: boolean }>;
  /**
   * GET /v1/integrations/sentry — observed verification status. Never returns
   * the secret itself. `triggers` may be `[]` per Sprint 1's GET implementation.
   */
  getSentryIntegrationStatus(): Promise<
    import('@/contexts/integrations/domain/types').SentryIntegrationStatus
  >;

  // Admin — fire test errors through Core API (AD-7/AD-8)
  // Core intentionally returns HTTP 500 + { error: 'TestErrorFired', traceId } to signal success.
  fireTestError(): Promise<{ triggered: boolean; traceId: string }>;
}
