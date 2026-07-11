import type { AuditEntry } from '@/contexts/audit/domain/types';
import type { SentryIntegrationStatus } from '@/contexts/integrations/domain/types';
import type { Incident, Remediation } from '@/contexts/investigation/domain/types';
import type {
  Locale,
  NotificationSettings,
  Theme,
  UserSettings,
} from '@/contexts/settings/domain/types';
import { logger } from '@/lib/logger';
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

/**
 * Error thrown when the Core API returns a non-2xx response. The dashboard's
 * BFF route handlers can read `.status` to map upstream codes to outgoing HTTP
 * statuses (e.g., 403 FORBIDDEN, 404 NOT_FOUND) instead of always serving 500.
 */
export class CoreApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CoreApiError';
    this.status = status;
  }
}

/**
 * Private wire shape returned by Core's GET /v1/analytics/incidents.
 * MUST NOT leak past this file — consumers see `IncidentAnalytics` instead.
 * Canonical mapping lives in `HttpApiClient.mapIncidentAnalytics()`.
 */
interface CoreIncidentAnalyticsWire {
  total: number;
  openCount: number;
  mttrMinutes: number | null;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  totalCostUsd: number;
  avgCostUsd: number | null;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `?${qs}`;
}

export class HttpApiClient implements ICoreApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => Promise<string>,
  ) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      // Read the body as text first so we can log it verbatim on failures.
      // Core API always returns JSON for errors (see error-handler.ts), but
      // CloudFront/WAF/edge layers can return HTML or plain text instead.
      const rawText = await res.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        body = { error: res.statusText };
      }
      const errMsg =
        typeof body.error === 'string'
          ? body.error
          : JSON.stringify(body.error) || `API error: ${res.status}`;
      logger.error(
        {
          type: 'core_api_error',
          path,
          status: res.status,
          statusText: res.statusText,
          rawBody: rawText.slice(0, 500),
          parsedErrMsg: errMsg,
        },
        `[http-api-client] Core API error: ${res.status} ${path}`,
      );
      throw new CoreApiError(errMsg, res.status);
    }
    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async healthDetailed(): Promise<HealthDetailedStatus> {
    // NOTE: Core's /health/detailed returns `{ status, checks, timestamp }`
    // (see core/src/shared/infra/health/health-checker.ts) which does NOT
    // match `HealthDetailedStatus` ({ status, version, timestamp, dependencies }).
    // This is tolerated because the dashboard no longer consumes this endpoint
    // from the UI (SystemStatus now calls `/api/health`). If a new consumer
    // is added, add a `mapHealthDetailed` remap here following the
    // mapIncidentAnalytics pattern.
    return this.request<HealthDetailedStatus>('/health/detailed');
  }

  /**
   * Remap Core's wire shape to the dashboard-side `IncidentAnalytics` contract.
   * Single point of translation — per PRD §6.1, this is the ONLY place where
   * Core's field names (`total`, `openCount`, `mttrMinutes`) are allowed.
   */
  private mapIncidentAnalytics(raw: CoreIncidentAnalyticsWire): IncidentAnalytics {
    return {
      totalIncidents: raw.total,
      openIncidents: raw.openCount,
      mttr: raw.mttrMinutes ?? 0,
      byStatus: raw.byStatus,
      bySeverity: raw.bySeverity,
      totalCostUsd: raw.totalCostUsd,
      avgCostUsd: raw.avgCostUsd,
    };
  }

  async getMe(): Promise<AuthUser> {
    return this.request<AuthUser>('/v1/whoami');
  }

  async listIncidents(params?: ListIncidentsParams): Promise<PaginatedResponse<Incident>> {
    const qs = buildQueryString({
      limit: params?.limit,
      cursor: params?.cursor,
      severity: params?.severity,
      status: params?.status,
      sort: params?.sort,
    });
    return this.request<PaginatedResponse<Incident>>(`/v1/incidents${qs}`);
  }

  async createIncident(body: {
    title: string;
    description: string;
    severity?: string;
    /**
     * Staff-only — stamps the reasoning strategy on the incident at
     * creation time so the dispatcher routes to the chosen mode when
     * the investigation kicks off. Core API silently drops the field
     * for non-staff callers.
     */
    investigationMode?: 'orchestrator' | 'hypothesis' | 'debate';
  }): Promise<any> {
    return this.request('/v1/incidents/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getIncident(incidentId: string): Promise<Incident> {
    return this.request<Incident>(`/v1/incidents/${encodeURIComponent(incidentId)}`);
  }

  async getInvestigationDetail(incidentId: string): Promise<InvestigationDetail> {
    return this.request<InvestigationDetail>(`/v1/investigation/${encodeURIComponent(incidentId)}`);
  }

  async getToolCall(incidentId: string, toolCallId: string): Promise<ToolCallDetail> {
    return this.request<ToolCallDetail>(
      `/v1/investigation/${encodeURIComponent(incidentId)}/tool-calls/${encodeURIComponent(toolCallId)}`,
    );
  }

  async updateIncident(incidentId: string, input: UpdateIncidentInput): Promise<Incident> {
    return this.request<Incident>(`/v1/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async listRemediations(incidentId: string): Promise<Remediation[]> {
    return this.request<Remediation[]>(`/v1/remediation/${encodeURIComponent(incidentId)}`);
  }

  async getRemediation(remediationId: string): Promise<Remediation> {
    return this.request<Remediation>(`/v1/remediation/detail/${encodeURIComponent(remediationId)}`);
  }

  async createRemediation(input: CreateRemediationInput): Promise<Remediation> {
    return this.request<Remediation>('/v1/remediation', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async approveRemediation(remediationId: string): Promise<Remediation> {
    return this.request<Remediation>(
      `/v1/remediation/${encodeURIComponent(remediationId)}/approve`,
      { method: 'POST' },
    );
  }

  async rejectRemediation(remediationId: string, reason?: string): Promise<Remediation> {
    return this.request<Remediation>(
      `/v1/remediation/${encodeURIComponent(remediationId)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
    );
  }

  async executeRemediation(remediationId: string): Promise<Remediation> {
    return this.request<Remediation>(
      `/v1/remediation/${encodeURIComponent(remediationId)}/execute`,
      { method: 'POST' },
    );
  }

  async listAuditEntries(params?: ListAuditParams): Promise<PaginatedResponse<AuditEntry>> {
    const qs = buildQueryString({
      action: params?.action,
      actorType: params?.actorType,
      limit: params?.limit,
      cursor: params?.cursor,
    });
    return this.request<PaginatedResponse<AuditEntry>>(`/v1/audit${qs}`);
  }

  async verifyAuditChain(): Promise<AuditVerification> {
    return this.request<AuditVerification>('/v1/audit/verify');
  }

  async listNotifications(
    params?: ListNotificationsParams,
  ): Promise<PaginatedResponse<ApiNotification>> {
    const qs = buildQueryString({
      cursor: params?.cursor,
      limit: params?.limit,
    });
    return this.request<PaginatedResponse<ApiNotification>>(`/v1/notifications${qs}`);
  }

  async getNotification(id: string): Promise<ApiNotification> {
    return this.request<ApiNotification>(`/v1/notifications/${encodeURIComponent(id)}`);
  }

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/v1/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  }

  async listPendingApprovals(): Promise<PendingApproval[]> {
    return this.request<PendingApproval[]>('/v1/notifications/approvals/pending');
  }

  async respondToApproval(approvalId: string, input: ApprovalRespondInput): Promise<unknown> {
    return this.request<unknown>(
      `/v1/notifications/approvals/${encodeURIComponent(approvalId)}/respond`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  async getTenant(tenantId: string): Promise<ApiTenant> {
    return this.request<ApiTenant>(`/v1/tenants/${encodeURIComponent(tenantId)}`);
  }

  async updateTenant(tenantId: string, input: UpdateTenantSettingsInput): Promise<ApiTenant> {
    return this.request<ApiTenant>(`/v1/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async createTenant(input: CreateTenantInput): Promise<ApiTenant> {
    return this.request<ApiTenant>('/v1/tenants', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    return this.request<CreatedApiKey>('/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listApiKeys(): Promise<ListApiKeysResponse> {
    return this.request<ListApiKeysResponse>('/v1/api-keys');
  }

  async revokeApiKey(keyId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/v1/api-keys/${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
    });
  }

  async submitFeedback(input: SubmitFeedbackInput): Promise<FeedbackItem> {
    return this.request<FeedbackItem>(
      `/v1/investigation/${encodeURIComponent(input.incidentId)}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  async listFeedback(incidentId: string): Promise<ListFeedbackResponse> {
    return this.request<ListFeedbackResponse>(
      `/v1/investigation/${encodeURIComponent(incidentId)}/feedback`,
    );
  }

  async getIncidentAnalytics(): Promise<IncidentAnalytics> {
    const raw = await this.request<CoreIncidentAnalyticsWire>('/v1/analytics/incidents');
    return this.mapIncidentAnalytics(raw);
  }

  async getPatternAnalytics(): Promise<PatternAnalytics> {
    return this.request<PatternAnalytics>('/v1/analytics/patterns');
  }

  async listServiceNodes(params?: {
    type?: string;
    healthStatus?: string;
    ownerTeam?: string;
  }): Promise<ServiceNode[]> {
    const qs = buildQueryString({
      type: params?.type,
      healthStatus: params?.healthStatus,
      ownerTeam: params?.ownerTeam,
    });
    return this.request<ServiceNode[]>(`/v1/graph${qs}`);
  }

  async getServiceNode(serviceId: string): Promise<ServiceNode> {
    return this.request<ServiceNode>(`/v1/graph/nodes/${encodeURIComponent(serviceId)}`);
  }

  async listServiceEdges(params?: {
    sourceService?: string;
    targetService?: string;
  }): Promise<ServiceEdge[]> {
    const qs = buildQueryString({
      sourceService: params?.sourceService,
      targetService: params?.targetService,
    });
    return this.request<ServiceEdge[]>(`/v1/graph/edges${qs}`);
  }

  async getSystemHealth(): Promise<SystemHealthSummary> {
    return this.request<SystemHealthSummary>('/v1/graph/health');
  }

  async getBlastRadius(serviceId: string, maxDepth?: number): Promise<BlastRadiusResult> {
    const qs = buildQueryString({ maxDepth });
    return this.request<BlastRadiusResult>(
      `/v1/graph/blast-radius/${encodeURIComponent(serviceId)}${qs}`,
    );
  }

  // Memory
  async getMemoryInsights(): Promise<any> {
    return this.request('/v1/memory/insights');
  }

  async getMemorySummary(): Promise<any> {
    return this.request('/v1/memory/summary');
  }

  async askMemory(body: { question: string; context?: string }): Promise<any> {
    return this.request('/v1/memory/chat', {
      method: 'POST',
      body: JSON.stringify({ message: body.question }),
    });
  }

  // Known solution
  async respondKnownSolution(
    incidentId: string,
    body: { response: 'accepted' | 'declined' },
  ): Promise<any> {
    return this.request(
      `/v1/investigation/${encodeURIComponent(incidentId)}/known-solution-response`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }

  // Investigation feedback
  async submitInvestigationFeedback(incidentId: string, body: any): Promise<any> {
    return this.request(`/v1/investigation/${encodeURIComponent(incidentId)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async submitRemediationFeedback(remediationId: string, body: any): Promise<any> {
    return this.request(`/v1/remediation/${encodeURIComponent(remediationId)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async abortInvestigation(incidentId: string): Promise<any> {
    return this.request(`/v1/investigation/${encodeURIComponent(incidentId)}/abort`, {
      method: 'POST',
    });
  }

  // Investigation context/trigger
  async addInvestigationContext(incidentId: string, body: any): Promise<any> {
    return this.request(`/v1/investigation/${encodeURIComponent(incidentId)}/context`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async triggerInvestigation(incidentId: string): Promise<any> {
    return this.request(`/v1/investigation/${encodeURIComponent(incidentId)}/investigate`, {
      method: 'POST',
    });
  }

  async triggerTriage(incidentId: string): Promise<any> {
    return this.request(`/v1/investigation/${encodeURIComponent(incidentId)}/triage`, {
      method: 'POST',
    });
  }

  async adminRunInvestigation(
    incidentId: string,
    body: {
      mode: 'orchestrator' | 'hypothesis' | 'debate';
      shadowMode?: 'orchestrator' | 'hypothesis' | 'debate';
      suggestedAgents?: string[];
    },
  ): Promise<any> {
    return this.request(`/v1/investigation/admin/${encodeURIComponent(incidentId)}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async listHypotheses(incidentId: string): Promise<any> {
    return this.request(`/v1/investigation/${encodeURIComponent(incidentId)}/hypotheses`);
  }

  // GitHub
  async setupGitHubApp(installationId: number, code: string): Promise<any> {
    const qs = buildQueryString({ installation_id: installationId, code });
    return this.request(`/v1/integrations/github/callback${qs}`, { method: 'POST' });
  }

  async getGitHubInstallation(): Promise<any> {
    return this.request('/v1/integrations/github/installation');
  }

  async revokeGitHubInstallation(): Promise<any> {
    return this.request('/v1/integrations/github/installation', { method: 'DELETE' });
  }

  // Integrations — catalog
  async getIntegrationCatalog(): Promise<any> {
    return this.request('/v1/integrations/catalog');
  }

  // Integrations — list connected
  async listIntegrations(): Promise<any> {
    return this.request('/v1/integrations');
  }

  // Integrations — Composio OAuth connect (returns { authUrl })
  async initiateOAuthConnect(provider: string, redirectUrl: string): Promise<{ authUrl: string }> {
    return this.request<{ authUrl: string }>('/v1/integrations/connect', {
      method: 'POST',
      body: JSON.stringify({ provider, redirectUrl }),
    });
  }

  // Integrations — revoke Composio OAuth
  async revokeOAuthConnection(provider: string): Promise<any> {
    return this.request(`/v1/integrations/connect/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
    });
  }

  // Integrations — AWS credential connect
  async connectCredential(provider: string, credentials: Record<string, unknown>): Promise<any> {
    return this.request('/v1/integrations/credentials', {
      method: 'POST',
      body: JSON.stringify({ provider, credentials }),
    });
  }

  // Integrations — OSS stub upstream connect (AC-055)
  async connectStubIntegration(body?: { baseUrl?: string; coreBaseUrl?: string }): Promise<{
    integrationId: string;
    provider: string;
    status: string;
    stubConnectionId: string;
    stubBaseUrl: string;
    connectedAt: string;
  }> {
    return this.request('/v1/integrations/stub/connect', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  }

  // Integrations — disconnect credential (AWS)
  async disconnectCredential(type: string): Promise<any> {
    return this.request(`/v1/integrations/credentials/${encodeURIComponent(type)}`, {
      method: 'DELETE',
    });
  }

  // Integrations — test AWS AssumeRole
  async testIntegrationConnection(body: any): Promise<any> {
    return this.request('/v1/integrations/test-connection', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Legacy aliases (kept for existing BFF handlers during transition)
  async getOAuthAuthorizeUrl(_provider: string): Promise<string> {
    // Not used by backend — initiateOAuthConnect is the correct method
    return '';
  }

  async storeOAuthToken(_provider: string, _body: any): Promise<any> {
    // Not used — Composio handles token exchange automatically
    return {};
  }

  async finalizeComposioConnection(
    provider: string,
    params: { connectedAccountId?: string },
  ): Promise<void> {
    await this.request(`/v1/integrations/connect/${encodeURIComponent(provider)}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ connectedAccountId: params.connectedAccountId }),
    });
  }

  async revokeOAuthIntegration(provider: string): Promise<any> {
    return this.revokeOAuthConnection(provider);
  }

  async getOAuthStatus(): Promise<any> {
    return this.listIntegrations();
  }

  async connectIntegration(body: { type: string; [key: string]: unknown }): Promise<any> {
    const { type, ...credentials } = body;
    return this.connectCredential(type, credentials);
  }

  async getAwsSetupInfo(): Promise<any> {
    const catalog = await this.getIntegrationCatalog();
    const aws = catalog.providers?.find((p: any) => p.id === 'aws');
    return aws?.setup ?? {};
  }

  // Triggers
  async listTriggers(): Promise<any[]> {
    return (await this.request<{ triggers: any[] }>('/v1/triggers')).triggers;
  }

  async createTrigger(
    body: import('@/contexts/integrations/domain/types').CreateTriggerInput,
  ): Promise<{
    trigger: import('@/contexts/integrations/domain/types').TriggerDto;
    webhookUrl?: string;
  }> {
    return this.request<{
      trigger: import('@/contexts/integrations/domain/types').TriggerDto;
      webhookUrl?: string;
    }>('/v1/triggers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deleteTrigger(id: string): Promise<{ success: boolean }> {
    await this.request(`/v1/triggers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { success: true };
  }

  async listAvailableTriggers(): Promise<any[]> {
    return (await this.request<{ triggers: any[] }>('/v1/triggers/available')).triggers;
  }

  // Relay
  async getRelayStatus(): Promise<any> {
    return this.request('/v1/relay/status');
  }

  // Billing
  async createCheckout(body: {
    planKey: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    return this.request('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getSubscription(): Promise<any> {
    return this.request('/v1/billing/subscription');
  }

  async createPortalSession(body: { returnUrl: string }): Promise<{ url: string }> {
    return this.request('/v1/billing/portal', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async createSubscription(body: {
    planId: string;
  }): Promise<{ subscriptionId: string; clientSecret: string; status: string }> {
    return this.request('/v1/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getPlans(): Promise<any[]> {
    return this.request('/v1/billing/plans');
  }

  async getCredits(): Promise<any> {
    return this.request('/v1/billing/credits');
  }

  async getUsageHistory(days?: number): Promise<any> {
    // Backend uses /v1/billing/usage with limit/cursor/type params
    const limit = days ? Math.min(days, 100) : 50;
    return this.request(`/v1/billing/usage?limit=${limit}`);
  }

  async getInvoices(_limit?: number): Promise<any> {
    // Invoices are managed via Stripe portal (POST /v1/billing/portal), not a dedicated endpoint
    return { invoices: [] };
  }

  async purchaseQuotaPack(body: {
    packType: 'investigations' | 'events';
    quantity: number;
  }): Promise<any> {
    return this.request('/v1/billing/purchase', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // User extras
  async getUserByEmail(email: string): Promise<any | null> {
    try {
      return await this.request(`/v1/users/by-email/${encodeURIComponent(email)}`);
    } catch {
      return null;
    }
  }

  async getUserProfile(userId: string): Promise<any | null> {
    try {
      return await this.request(`/v1/users/${encodeURIComponent(userId)}/profile`);
    } catch {
      return null;
    }
  }

  // Beta
  async checkBetaAllowlist(email: string): Promise<any> {
    return this.request('/v1/beta-allowlist/check', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async recordTermsAcceptance(body: any): Promise<any> {
    return this.request('/v1/audit/terms-acceptance', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Team
  async listTeamMembers(params?: ListTeamMembersParams): Promise<ListTeamMembersResponse> {
    const qs = buildQueryString({ cursor: params?.cursor });
    return this.request<ListTeamMembersResponse>(`/v1/team${qs}`);
  }

  async removeTeamMember(userId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/v1/team/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }

  async changeTeamMemberRole(
    userId: string,
    input: ChangeRoleInput,
  ): Promise<{ success: boolean; userId: string; role: string }> {
    return this.request<{ success: boolean; userId: string; role: string }>(
      `/v1/team/${encodeURIComponent(userId)}/role`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
  }

  // Invites
  async createInvite(input: CreateInviteInput): Promise<{ invite: TeamInvite }> {
    return this.request<{ invite: TeamInvite }>('/v1/team/invites', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listInvites(): Promise<{ invites: TeamInvite[] }> {
    return this.request<{ invites: TeamInvite[] }>('/v1/team/invites');
  }

  async revokeInvite(email: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/v1/team/invites/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  }

  // Memory seeding
  async seedMemoryContext(input: {
    source: 'business-profile';
    schemaVersion: string;
    markdown: string;
  }): Promise<{ memoryId?: string }> {
    // TODO(core-api-seed-endpoint): Swap to POST /v1/memory/seed once the dedicated
    // seeding endpoint ships on CORE-API. Tracked in PRD §6.3 / §12 Q1. The
    // ICoreApiClient.seedMemoryContext interface will not change — only the URL
    // and request body shape here.
    return this.request<{ memoryId?: string }>('/v1/memory/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: input.markdown,
        metadata: { source: input.source, schemaVersion: input.schemaVersion },
      }),
    });
  }

  // User settings
  async getUserSettings(userId: string): Promise<UserSettings> {
    return this.request<UserSettings>(`/v1/users/${encodeURIComponent(userId)}/settings`);
  }

  async updateUserSettings(
    userId: string,
    input: { theme?: Theme; locale?: Locale; notifications?: NotificationSettings },
  ): Promise<UserSettings> {
    return this.request<UserSettings>(`/v1/users/${encodeURIComponent(userId)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  // Slack integration
  async getSlackConfig(): Promise<SlackConfigResponse> {
    return this.request<SlackConfigResponse>('/v1/integrations/slack/config');
  }

  async updateSlackConfig(input: SlackConfigUpdateInput): Promise<SlackConfigResponse> {
    return this.request<SlackConfigResponse>('/v1/integrations/slack/config', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deleteSlackOAuth(): Promise<void> {
    await this.request<void>('/v1/integrations/slack/oauth', { method: 'DELETE' });
  }

  async testSlackConnection(): Promise<{ ok: boolean; error?: string }> {
    return this.request<{ ok: boolean; error?: string }>('/v1/integrations/slack/test', {
      method: 'POST',
    });
  }

  /**
   * AD-3 / AD-4 / AD-5: Save the Sentry Internal Integration Client Secret.
   *
   * The dashboard never holds the Client Secret at rest — it forwards once via
   * this BFF request and never logs it. Core extracts the tenantId from the
   * Clerk JWT `org_id` claim (W4); never trust a tenantId from the body.
   *
   * Response: `{ hasClientSecret: true, verified: false }` per Sprint 1's
   * contract — verified flips to true only after Core sees a valid HMAC-signed
   * webhook hit.
   */
  async saveSentryClientSecret(
    secret: string,
  ): Promise<{ hasClientSecret: true; verified: boolean }> {
    return this.request<{ hasClientSecret: true; verified: boolean }>('/v1/integrations/sentry', {
      method: 'POST',
      body: JSON.stringify({ clientSecret: secret }),
    });
  }

  /**
   * AD-3 / AD-4: Fetch observed Sentry verification status. Never returns the
   * secret. `triggers` may be `[]` per Sprint 1's GET implementation; the UI
   * must tolerate that.
   */
  async getSentryIntegrationStatus(): Promise<SentryIntegrationStatus> {
    const raw = await this.request<Partial<SentryIntegrationStatus>>('/v1/integrations/sentry');
    // Tolerate Sprint 1 GET implementation that may omit `triggers` (Agent Note 🟡).
    return {
      hasClientSecret: Boolean(raw.hasClientSecret),
      verified: Boolean(raw.verified),
      verifiedAt: raw.verifiedAt ?? null,
      lastEventAt: raw.lastEventAt ?? null,
      triggers: Array.isArray(raw.triggers) ? raw.triggers : [],
    };
  }

  /**
   * AD-7 / AD-8: Fire a test error through the Core API.
   *
   * Core intentionally returns HTTP 500 + { error: 'TestErrorFired', traceId } to signal
   * that the error was captured by Sentry. This method MUST bypass `this.request()` because
   * `request()` throws `CoreApiError` on any non-2xx, which would swallow the success signal.
   *
   * W4: tenantId is NEVER sent — Core extracts it from the Clerk JWT org_id claim.
   */
  async fireTestError(): Promise<{ triggered: boolean; traceId: string }> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/v1/admin/fire-test-errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // Guard against non-JSON bodies from edge infrastructure (CloudFront, WAF, cold-start error pages).
    const rawText = await res.text();
    let body: { error?: string; traceId?: string };
    try {
      body = JSON.parse(rawText) as { error?: string; traceId?: string };
    } catch {
      throw new CoreApiError('Non-JSON response from /v1/admin/fire-test-errors', res.status);
    }

    // HTTP 500 + TestErrorFired = intentional success signal from Core API (AD-7)
    if (res.status >= 500 && body.error === 'TestErrorFired') {
      return { triggered: true, traceId: body.traceId ?? 'unknown' };
    }

    // Any other non-2xx response is a genuine error
    if (!res.ok) {
      throw new CoreApiError(body.error ?? `API error: ${res.status}`, res.status);
    }

    // Unexpected 2xx — per contract, success is strictly 5xx + TestErrorFired.
    // A 2xx indicates a cache hit, proxy misconfiguration, or future Core refactor — treat as error.
    throw new CoreApiError(
      'Unexpected 2xx from /v1/admin/fire-test-errors — expected 500+TestErrorFired',
      res.status,
    );
  }
}
