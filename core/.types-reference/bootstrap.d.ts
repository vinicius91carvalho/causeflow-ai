import type { BillingUseCases } from './modules/billing/infra/billing.routes.js';
import { EventBus } from './shared/domain/events.js';
import { CreateAuditEntryUseCase } from './modules/audit/application/create-audit-entry.usecase.js';
import { ProviderRegistry } from './shared/application/provider-registry.js';
import { SSEManager } from './shared/infra/chat/sse-manager.js';
import type { NotificationUseCases } from './modules/notification/infra/notification.routes.js';
import { HealthChecker } from './shared/infra/health/health-checker.js';
import type { LLMClient } from './shared/application/ports/llm-client.port.js';
import type { AgentRunner } from './shared/application/ports/agent-runner.port.js';
import type { TenantUseCases } from './modules/tenant/infra/tenant.routes.js';
import type { AuditUseCases } from './modules/audit/infra/audit.routes.js';
import type { WebhookUseCases } from './modules/ingestion/infra/webhook.routes.js';
import type { IncidentUseCases } from './modules/ingestion/infra/incident.routes.js';
import type { TriageUseCases } from './modules/triage/infra/triage.routes.js';
import type { InvestigationUseCases } from './modules/investigation/infra/investigation.routes.js';
import type { RemediationUseCases } from './modules/remediation/infra/remediation.routes.js';
import type { AnalyticsUseCases } from './modules/ingestion/infra/analytics.routes.js';
import type { AdminDeps } from './modules/ingestion/infra/admin.routes.js';
import type { ApiKeyUseCases } from './modules/tenant/infra/api-key.routes.js';
import type { OAuthDeps } from './modules/integration/infra/oauth.routes.js';
import type { IntegrationUseCases } from './modules/integration/infra/integration.routes.js';
import type { AuthUseCases } from './modules/auth/infra/auth.routes.js';
import type { CodeKnowledgeUseCases } from './modules/code-intelligence/infra/code-knowledge.routes.js';
import type { ICodeRepository } from './shared/application/ports/code-repository.port.js';
import type { IRelayGateway } from './shared/application/ports/relay-gateway.port.js';
import type { TenantId } from './shared/domain/value-objects.js';
import type { UserUseCases } from './modules/user/infra/user.routes.js';
export interface ConsumerHandle {
    stop: () => void;
}
export interface AppContext {
    eventBus: EventBus;
    providerRegistry: ProviderRegistry;
    tenantUseCases: TenantUseCases;
    auditUseCases: AuditUseCases;
    createAuditEntry: CreateAuditEntryUseCase;
    webhookUseCases: WebhookUseCases;
    incidentUseCases: IncidentUseCases;
    triageUseCases: TriageUseCases;
    investigationUseCases: InvestigationUseCases;
    remediationUseCases: RemediationUseCases;
    notificationUseCases: NotificationUseCases;
    analyticsUseCases: AnalyticsUseCases;
    adminDeps: AdminDeps;
    apiKeyUseCases: ApiKeyUseCases;
    codeKnowledgeUseCases: CodeKnowledgeUseCases;
    memoryUseCases: import('./modules/memory/infra/memory.routes.js').MemoryUseCases;
    integrationUseCases: IntegrationUseCases;
    oauthDeps: OAuthDeps;
    composioWebhookDeps?: import('./modules/integration/infra/trigger.routes.js').ComposioWebhookDeps;
    triggerUseCases?: import('./modules/integration/infra/trigger.routes.js').TriggerUseCases;
    billingUseCases: BillingUseCases;
    authUseCases: AuthUseCases;
    userUseCases: UserUseCases;
    betaAllowlistRoutes?: ReturnType<typeof import('./modules/tenant/infra/beta-allowlist.routes.js').createBetaAllowlistRoutes>;
    relayGateway?: IRelayGateway;
    sseManager: SSEManager;
    healthChecker: HealthChecker;
    consumers: ConsumerHandle[];
    corsOrigins: string[];
}
export interface BootstrapOverrides {
    llmClient?: LLMClient;
    agentRunner?: AgentRunner;
    codeRepoFactory?: (tenantId: TenantId) => ICodeRepository | undefined;
    relayGateway?: IRelayGateway;
}
export declare function bootstrap(overrides?: BootstrapOverrides): AppContext;
