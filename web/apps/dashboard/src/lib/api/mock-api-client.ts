import { randomUUID } from 'node:crypto';
import type { AuditEntry } from '@/contexts/audit/domain/types';
import type { Incident, Remediation } from '@/contexts/investigation/domain/types';
import type {
  Locale,
  NotificationSettings,
  Theme,
  UserSettings,
} from '@/contexts/settings/domain/types';
import type { ICoreApiClient } from './core-api-client';
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
import { CoreApiError } from './http-api-client';

const MOCK_TENANT_ID = 'ten_mock_local';
const MOCK_USER_ID = 'usr_mock_local';
const NOW = new Date().toISOString();

const defaultNotifications: NotificationSettings = {
  emailOnComplete: true,
  emailOnError: true,
  slackOnComplete: false,
  slackOnError: false,
};

const defaultUserSettings: UserSettings = {
  theme: 'system',
  locale: 'en',
  notifications: defaultNotifications,
  createdAt: NOW,
  updatedAt: NOW,
};

const mockTenant: ApiTenant = {
  tenantId: MOCK_TENANT_ID,
  name: 'Acme Engineering',
  slug: 'acme-engineering',
  ownerEmail: 'dev@example.com',
  plan: 'starter',
  status: 'active',
  settings: {
    maxIncidentsPerMonth: 20,
    autoRemediation: false,
    notificationChannels: ['email'],
    chatProvider: 'slack',
  },
  createdAt: NOW,
};

const seedIncidents: Incident[] = [
  {
    tenantId: MOCK_TENANT_ID,
    incidentId: 'inc_mock_001',
    title: 'Elevated 5xx on checkout API',
    description: 'Mock incident for local development without CORE_API_URL.',
    severity: 'high',
    status: 'investigating',
    sourceProvider: 'pagerduty',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    tenantId: MOCK_TENANT_ID,
    incidentId: 'inc_mock_002',
    title: 'Redis connection pool saturation',
    description: 'Second mock incident for list views.',
    severity: 'medium',
    status: 'resolved',
    sourceProvider: 'datadog',
    resolvedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

function emptyPage<T>(): PaginatedResponse<T> {
  return { items: [] };
}

function ok<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/**
 * In-memory Core API client used when `CORE_API_URL` is blank.
 * Returns deterministic mock data so the dashboard runs with no external services.
 */
export class MockApiClient implements ICoreApiClient {
  private incidents = [...seedIncidents];
  private notifications: ApiNotification[] = [];
  private invites: TeamInvite[] = [];
  private userSettings = new Map<string, UserSettings>();

  healthCheck(): Promise<HealthStatus> {
    return ok({ status: 'ok', version: 'mock', timestamp: NOW });
  }

  healthDetailed(): Promise<HealthDetailedStatus> {
    return ok({
      status: 'ok',
      version: 'mock',
      timestamp: NOW,
      dependencies: [],
    });
  }

  getMe(): Promise<AuthUser> {
    return ok({
      tenantId: MOCK_TENANT_ID,
      userId: MOCK_USER_ID,
      email: 'dev@example.com',
      roles: ['admin'],
    });
  }

  listIncidents(params?: ListIncidentsParams): Promise<PaginatedResponse<Incident>> {
    let items = [...this.incidents];
    if (params?.status) {
      items = items.filter((incident) => incident.status === params.status);
    }
    const limit = params?.limit ?? 20;
    return ok({ items: items.slice(0, limit) });
  }

  getIncident(incidentId: string): Promise<Incident> {
    const incident = this.incidents.find((item) => item.incidentId === incidentId);
    if (!incident) {
      return Promise.reject(new Error(`Incident not found: ${incidentId}`));
    }
    return ok(incident);
  }

  updateIncident(incidentId: string, input: UpdateIncidentInput): Promise<Incident> {
    const index = this.incidents.findIndex((item) => item.incidentId === incidentId);
    if (index < 0) {
      return Promise.reject(new Error(`Incident not found: ${incidentId}`));
    }
    const current = this.incidents[index];
    if (!current) {
      return Promise.reject(new Error(`Incident not found: ${incidentId}`));
    }
    const updated: Incident = {
      ...current,
      status: input.status as Incident['status'],
      updatedAt: new Date().toISOString(),
    };
    this.incidents[index] = updated;
    return ok(updated);
  }

  getInvestigationDetail(incidentId: string): Promise<InvestigationDetail> {
    return this.getIncident(incidentId).then((incident) => ({
      incident,
      evidenceByAgent: {},
    }));
  }

  getToolCall(incidentId: string, toolCallId: string): Promise<ToolCallDetail> {
    return ok({
      tenantId: MOCK_TENANT_ID,
      incidentId,
      toolCallId,
      agentRole: 'seeker',
      name: 'logs.search',
      origin: 'real',
      input: {},
      output: '{}',
      success: true,
      createdAt: NOW,
    });
  }

  listRemediations(_incidentId: string): Promise<Remediation[]> {
    return ok([]);
  }

  getRemediation(remediationId: string): Promise<Remediation> {
    return Promise.reject(new Error(`Remediation not found: ${remediationId}`));
  }

  createRemediation(input: CreateRemediationInput): Promise<Remediation> {
    return ok({
      tenantId: MOCK_TENANT_ID,
      remediationId: `rem_${randomUUID()}`,
      incidentId: input.incidentId,
      description: input.rootCause,
      rootCause: input.rootCause,
      status: 'proposed',
      proposedBy: MOCK_USER_ID,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  approveRemediation(remediationId: string): Promise<Remediation> {
    return this.getRemediation(remediationId);
  }

  rejectRemediation(remediationId: string, _reason?: string): Promise<Remediation> {
    return this.getRemediation(remediationId);
  }

  executeRemediation(remediationId: string): Promise<Remediation> {
    return this.getRemediation(remediationId);
  }

  listAuditEntries(_params?: ListAuditParams): Promise<PaginatedResponse<AuditEntry>> {
    return ok(emptyPage<AuditEntry>());
  }

  verifyAuditChain(): Promise<AuditVerification> {
    return ok({ valid: true, totalEntries: 0, brokenAt: null });
  }

  listNotifications(
    _params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<ApiNotification>> {
    return ok({ items: this.notifications });
  }

  getNotification(id: string): Promise<ApiNotification> {
    const notification = this.notifications.find((item) => item.notificationId === id);
    if (!notification) {
      return Promise.reject(new Error(`Notification not found: ${id}`));
    }
    return ok(notification);
  }

  markNotificationRead(id: string): Promise<{ success: boolean }> {
    const notification = this.notifications.find((item) => item.notificationId === id);
    if (notification) notification.read = true;
    return ok({ success: true });
  }

  listPendingApprovals(): Promise<PendingApproval[]> {
    return ok([]);
  }

  respondToApproval(_approvalId: string, _input: ApprovalRespondInput): Promise<unknown> {
    return ok({ success: true });
  }

  getTenant(_tenantId: string): Promise<ApiTenant> {
    return ok(mockTenant);
  }

  updateTenant(tenantId: string, input: UpdateTenantSettingsInput): Promise<ApiTenant> {
    return ok({
      ...mockTenant,
      tenantId,
      name: input.name ?? mockTenant.name,
      settings: {
        ...mockTenant.settings,
        autoRemediation: input.settings?.autoRemediation ?? mockTenant.settings.autoRemediation,
        notificationChannels:
          input.settings?.notificationChannels ?? mockTenant.settings.notificationChannels,
      },
    });
  }

  createTenant(input: CreateTenantInput): Promise<ApiTenant> {
    return ok({
      ...mockTenant,
      tenantId: `ten_${randomUUID()}`,
      name: input.name,
      slug: input.slug,
      ownerEmail: input.ownerEmail,
    });
  }

  createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const created: CreatedApiKey = {
      id: `key_${randomUUID()}`,
      name: input.name,
      prefix: 'cf_mock',
      key: `cf_mock_${randomUUID()}`,
      createdAt: NOW,
    };
    return ok(created);
  }

  listApiKeys(): Promise<ListApiKeysResponse> {
    return ok({ keys: [] });
  }

  revokeApiKey(_keyId: string): Promise<{ success: boolean }> {
    return ok({ success: true });
  }

  submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackItem> {
    return ok({
      id: `fb_${randomUUID()}`,
      incidentId: input.incidentId,
      type: input.type,
      comment: input.freeText,
      actor: MOCK_USER_ID,
      createdAt: NOW,
    });
  }

  listFeedback(_incidentId: string): Promise<ListFeedbackResponse> {
    return ok({ feedback: [] });
  }

  getIncidentAnalytics(): Promise<IncidentAnalytics> {
    return ok({
      totalIncidents: this.incidents.length,
      openIncidents: this.incidents.filter((item) => item.status !== 'resolved').length,
      mttr: 42,
      byStatus: {},
      bySeverity: {},
      totalCostUsd: 0,
      avgCostUsd: null,
    });
  }

  getPatternAnalytics(): Promise<PatternAnalytics> {
    return ok({
      topCategories: [],
      confidenceDistribution: [],
      resolutionRates: { automated: 0, manual: 0, pending: 0 },
      totalPatterns: 0,
      avgConfidence: 0,
    });
  }

  listServiceNodes(): Promise<ServiceNode[]> {
    return ok([]);
  }

  getServiceNode(serviceId: string): Promise<ServiceNode> {
    return Promise.reject(new Error(`Service not found: ${serviceId}`));
  }

  listServiceEdges(): Promise<ServiceEdge[]> {
    return ok([]);
  }

  getSystemHealth(): Promise<SystemHealthSummary> {
    return ok({
      totalServices: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
    });
  }

  getBlastRadius(serviceId: string, maxDepth?: number): Promise<BlastRadiusResult> {
    return ok({
      sourceService: serviceId,
      affectedServices: [],
      totalAffected: 0,
      maxDepth: maxDepth ?? 0,
    });
  }

  getMemoryInsights(): Promise<any> {
    return ok({ insights: [] });
  }

  getMemorySummary(): Promise<any> {
    return ok({ totalMemories: 0, lastUpdated: NOW });
  }

  askMemory(body: { question: string; context?: string }): Promise<any> {
    return ok({ answer: `Mock response for: ${body.question}`, sources: [] });
  }

  respondKnownSolution(
    _incidentId: string,
    _body: { response: 'accepted' | 'declined' },
  ): Promise<any> {
    return ok({ success: true });
  }

  submitInvestigationFeedback(_incidentId: string, _body: any): Promise<any> {
    return ok({ success: true });
  }

  submitRemediationFeedback(_remediationId: string, _body: any): Promise<any> {
    return ok({ success: true });
  }

  abortInvestigation(_incidentId: string): Promise<any> {
    return ok({ success: true });
  }

  addInvestigationContext(_incidentId: string, _body: any): Promise<any> {
    return ok({ success: true });
  }

  triggerInvestigation(_incidentId: string): Promise<any> {
    return ok({ success: true });
  }

  triggerTriage(_incidentId: string): Promise<any> {
    return ok({ success: true });
  }

  adminRunInvestigation(_incidentId: string, _body: any): Promise<any> {
    return ok({ incidentId: _incidentId, status: 'queued' });
  }

  listHypotheses(_incidentId: string): Promise<any> {
    return ok([]);
  }

  setupGitHubApp(_installationId: number, _code: string): Promise<any> {
    return ok({ connected: true });
  }

  getGitHubInstallation(): Promise<any> {
    return ok({ connected: false });
  }

  revokeGitHubInstallation(): Promise<any> {
    return ok({ success: true });
  }

  getIntegrationCatalog(): Promise<any> {
    return ok({ integrations: [] });
  }

  listIntegrations(): Promise<any> {
    return ok({ integrations: [] });
  }

  initiateOAuthConnect(_provider: string, _redirectUrl: string): Promise<{ authUrl?: string }> {
    // OSS stub: 200 with deterministic empty data (AC-051) — no OAuth redirect.
    return ok({});
  }

  revokeOAuthConnection(_provider: string): Promise<any> {
    return ok({ success: true });
  }

  finalizeComposioConnection(
    _provider: string,
    _params: { connectedAccountId?: string },
  ): Promise<void> {
    return Promise.resolve();
  }

  connectCredential(_provider: string, _credentials: Record<string, unknown>): Promise<any> {
    return ok({ connected: true });
  }

  connectStubIntegration(_body?: { baseUrl?: string; coreBaseUrl?: string }): Promise<{
    integrationId: string;
    provider: string;
    status: string;
    stubConnectionId: string;
    stubBaseUrl: string;
    connectedAt: string;
  }> {
    return ok({
      integrationId: 'stub-upstream-credential',
      provider: 'stub-upstream',
      status: 'active',
      stubConnectionId: 'mock-stub-connection',
      stubBaseUrl: 'http://127.0.0.1:5190',
      connectedAt: new Date().toISOString(),
    });
  }

  enableStubConnector(body: { provider: string }): Promise<{
    integrationId: string;
    provider: string;
    status: string;
    stubBaseUrl: string;
    linkedTo: string;
    connectedAt: string;
  }> {
    return ok({
      integrationId: `${body.provider}-stub-credential`,
      provider: body.provider,
      status: 'active',
      stubBaseUrl: 'http://127.0.0.1:5190',
      linkedTo: 'stub-upstream',
      connectedAt: new Date().toISOString(),
    });
  }

  probeStubIntegration(): Promise<{
    success: boolean;
    message: string;
    probeCount: number;
    stubState: Record<string, unknown>;
    probedAt: string;
  }> {
    return ok({
      success: true,
      message: 'Stub upstream probe succeeded',
      probeCount: 0,
      stubState: {},
      probedAt: new Date().toISOString(),
    });
  }

  disconnectCredential(_type: string): Promise<any> {
    return ok({ success: true });
  }

  testIntegrationConnection(_body: any): Promise<any> {
    return ok({ ok: true });
  }

  connectIntegration(body: { type: string; [key: string]: unknown }): Promise<any> {
    return ok({ type: body.type, connected: true });
  }

  getOAuthAuthorizeUrl(_provider: string): Promise<string> {
    return ok('http://localhost/mock-oauth');
  }

  storeOAuthToken(_provider: string, _body: any): Promise<any> {
    return ok({ success: true });
  }

  revokeOAuthIntegration(_provider: string): Promise<any> {
    return ok({ success: true });
  }

  getOAuthStatus(): Promise<any> {
    return ok({ integrations: [] });
  }

  getAwsSetupInfo(): Promise<any> {
    return ok({ roleArn: 'arn:aws:iam::000000000000:role/mock' });
  }

  listTriggers(): Promise<any[]> {
    return ok([]);
  }

  createTrigger(body: import('@/contexts/integrations/domain/types').CreateTriggerInput): Promise<{
    trigger: import('@/contexts/integrations/domain/types').TriggerDto;
    webhookUrl?: string;
  }> {
    return ok({
      trigger: {
        triggerId: `trg_${randomUUID()}`,
        triggerSlug: body.triggerSlug,
        provider: body.provider,
        status: 'active',
        connectedAccountId: 'mock-account',
        createdAt: NOW,
        updatedAt: NOW,
      },
      webhookUrl: 'http://localhost/mock-webhook',
    });
  }

  deleteTrigger(_id: string): Promise<{ success: boolean }> {
    return ok({ success: true });
  }

  listAvailableTriggers(): Promise<any[]> {
    return ok([]);
  }

  createIncident(body: {
    title: string;
    description: string;
    severity?: string;
    investigationMode?: 'orchestrator' | 'hypothesis' | 'debate';
  }): Promise<any> {
    const incident: Incident = {
      tenantId: MOCK_TENANT_ID,
      incidentId: `inc_${randomUUID()}`,
      title: body.title,
      description: body.description,
      severity: (body.severity as Incident['severity']) ?? 'medium',
      status: 'open',
      sourceProvider: 'manual',
      investigationMode: body.investigationMode,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.incidents.unshift(incident);
    return ok(incident);
  }

  getPlans(): Promise<any[]> {
    return ok([
      { id: 'starter', name: 'Starter', priceMonthly: 79 },
      { id: 'pro', name: 'Pro', priceMonthly: 249 },
    ]);
  }

  getSubscription(): Promise<any> {
    // OSS stub shape (AC-043/AC-048) when CAUSEFLOW_RUNTIME=oss.
    if (process.env.CAUSEFLOW_RUNTIME === 'oss') {
      return ok({
        plan: 'free',
        status: 'active',
        investigationsLimit: 3,
        investigationsUsed: 0,
        currentPeriodEnd: null,
      });
    }
    return ok({
      plan: 'starter',
      status: 'active',
      investigationsLimit: 20,
      investigationsUsed: 2,
      currentPeriodEnd: null,
    });
  }

  createCheckout(_body: {
    planKey: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    if (process.env.CAUSEFLOW_RUNTIME === 'oss') {
      return Promise.reject(
        new CoreApiError('Billing is disabled in the OSS build. Checkout is not available.', 410),
      );
    }
    return ok({ url: 'http://localhost/mock-checkout' });
  }

  createPortalSession(_body: { returnUrl: string }): Promise<{ url: string }> {
    if (process.env.CAUSEFLOW_RUNTIME === 'oss') {
      return Promise.reject(
        new CoreApiError('Billing is disabled in the OSS build. Portal is not available.', 410),
      );
    }
    return ok({ url: 'http://localhost/mock-portal' });
  }

  createSubscription(_body: { planId: string }): Promise<{
    subscriptionId: string;
    clientSecret: string;
    status: string;
  }> {
    return ok({
      subscriptionId: `sub_${randomUUID()}`,
      clientSecret: 'mock_client_secret',
      status: 'active',
    });
  }

  getRelayStatus(): Promise<any> {
    return ok({ connected: false });
  }

  getCredits(): Promise<any> {
    return ok({ remaining: 18, limit: 20 });
  }

  getUsageHistory(_days?: number): Promise<any> {
    return ok({ days: [], total: 0 });
  }

  getInvoices(_limit?: number): Promise<any> {
    return ok({ invoices: [] });
  }

  purchaseQuotaPack(_body: {
    packType: 'investigations' | 'events';
    quantity: number;
  }): Promise<any> {
    return ok({ success: true });
  }

  getUserByEmail(_email: string): Promise<any | null> {
    return ok(null);
  }

  getUserProfile(userId: string): Promise<any | null> {
    return ok({
      userId,
      name: 'Local Dev User',
      email: 'dev@example.com',
      role: 'admin',
      settings: this.userSettings.get(userId) ?? defaultUserSettings,
    });
  }

  checkBetaAllowlist(_email: string): Promise<any> {
    return ok({ allowed: true });
  }

  recordTermsAcceptance(_body: any): Promise<any> {
    return ok({ success: true });
  }

  listTeamMembers(_params?: ListTeamMembersParams): Promise<ListTeamMembersResponse> {
    return ok({
      members: [
        {
          id: MOCK_USER_ID,
          tenantId: MOCK_TENANT_ID,
          email: 'dev@example.com',
          name: 'Local Dev User',
          role: 'admin',
          profileComplete: true,
          createdAt: NOW,
        },
      ],
      pagination: { cursor: null },
    });
  }

  removeTeamMember(_userId: string): Promise<{ success: boolean }> {
    return ok({ success: true });
  }

  changeTeamMemberRole(
    userId: string,
    input: ChangeRoleInput,
  ): Promise<{ success: boolean; userId: string; role: string }> {
    return ok({ success: true, userId, role: input.role });
  }

  createInvite(input: CreateInviteInput): Promise<{ invite: TeamInvite }> {
    const invite: TeamInvite = {
      tenantId: MOCK_TENANT_ID,
      email: input.email,
      role: input.role,
      invitedBy: MOCK_USER_ID,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      createdAt: NOW,
    };
    this.invites.push(invite);
    return ok({ invite });
  }

  listInvites(): Promise<{ invites: TeamInvite[] }> {
    return ok({ invites: this.invites });
  }

  revokeInvite(email: string): Promise<{ success: boolean }> {
    this.invites = this.invites.filter((invite) => invite.email !== email);
    return ok({ success: true });
  }

  seedMemoryContext(_input: {
    source: 'business-profile';
    schemaVersion: string;
    markdown: string;
  }): Promise<{ memoryId?: string }> {
    return ok({ memoryId: `mem_${randomUUID()}` });
  }

  getUserSettings(userId: string): Promise<UserSettings> {
    return ok(this.userSettings.get(userId) ?? defaultUserSettings);
  }

  updateUserSettings(
    userId: string,
    input: { theme?: Theme; locale?: Locale; notifications?: NotificationSettings },
  ): Promise<UserSettings> {
    const current = this.userSettings.get(userId) ?? defaultUserSettings;
    const updated: UserSettings = {
      ...current,
      theme: input.theme ?? current.theme,
      locale: input.locale ?? current.locale,
      notifications: input.notifications ?? current.notifications,
      updatedAt: new Date().toISOString(),
    };
    this.userSettings.set(userId, updated);
    return ok(updated);
  }

  getSlackConfig(): Promise<SlackConfigResponse> {
    return ok({ connected: false });
  }

  updateSlackConfig(input: SlackConfigUpdateInput): Promise<SlackConfigResponse> {
    return ok({ connected: true, channel: input.channel });
  }

  deleteSlackOAuth(): Promise<void> {
    return Promise.resolve();
  }

  testSlackConnection(): Promise<{ ok: boolean; error?: string }> {
    return ok({ ok: true });
  }

  saveSentryClientSecret(_secret: string): Promise<{ hasClientSecret: true; verified: boolean }> {
    return ok({ hasClientSecret: true, verified: true });
  }

  getSentryIntegrationStatus(): Promise<
    import('@/contexts/integrations/domain/types').SentryIntegrationStatus
  > {
    return ok({
      hasClientSecret: false,
      verified: false,
      verifiedAt: null,
      lastEventAt: null,
      triggers: [],
    });
  }

  fireTestError(): Promise<{ triggered: boolean; traceId: string }> {
    return ok({ triggered: true, traceId: `trace_${randomUUID()}` });
  }
}
