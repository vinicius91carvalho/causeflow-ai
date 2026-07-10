import { EventBus } from './shared/domain/events.js';
import { DynamoTenantRepository } from './modules/tenant/infra/dynamo-tenant.repository.js';
import { CreateTenantUseCase } from './modules/tenant/application/create-tenant.usecase.js';
import { GetTenantUseCase } from './modules/tenant/application/get-tenant.usecase.js';
import { UpdateTenantUseCase } from './modules/tenant/application/update-tenant.usecase.js';
import { ListTenantsUseCase } from './modules/tenant/application/list-tenants.usecase.js';
import { DynamoAuditRepository } from './modules/audit/infra/dynamo-audit.repository.js';

import { CreateAuditEntryUseCase } from './modules/audit/application/create-audit-entry.usecase.js';
import { DeleteAuditEntryUseCase } from './modules/audit/application/delete-audit-entry.usecase.js';
import { VerifyHashChainUseCase } from './modules/audit/application/verify-hash-chain.usecase.js';
import { ListAuditEntriesUseCase } from './modules/audit/application/list-audit-entries.usecase.js';
import { ExportAuditUseCase } from './modules/audit/application/export-audit.usecase.js';
import {
  resolveIncidentCreatedActor,
  resolveIncidentStatusChangedActor,
  resolveInvestigationCompletedActor,
  extractEvidencesFromPayload,
  resolveTenantActor,
  resolveRemediationActor,
  resolveRemediationApprovedActor,
  resolveRemediationRejectedActor,
  resolveApiKeyCreatedActor,
  resolveApiKeyRevokedActor,
} from './modules/audit/application/resolve-actor.js';
import { ProviderRegistry } from './shared/application/provider-registry.js';
import { DynamoIncidentRepository } from './modules/ingestion/infra/dynamo-incident.repository.js';
import { IngestAlertUseCase } from './modules/ingestion/application/ingest-alert.usecase.js';
import { GetIncidentUseCase } from './modules/ingestion/application/get-incident.usecase.js';
import { ListIncidentsUseCase } from './modules/ingestion/application/list-incidents.usecase.js';
import { UpdateIncidentStatusUseCase } from './modules/ingestion/application/update-incident-status.usecase.js';
import { UpdateIncidentSeverityUseCase } from './modules/ingestion/application/update-incident-severity.usecase.js';
import { GetIncidentAnalyticsUseCase } from './modules/ingestion/application/get-incident-analytics.usecase.js';
import { DatadogParser } from './modules/ingestion/infra/parsers/datadog.parser.js';
import { GrafanaParser } from './modules/ingestion/infra/parsers/grafana.parser.js';
import { CloudWatchParser } from './modules/ingestion/infra/parsers/cloudwatch.parser.js';
import { SentryParser } from './modules/ingestion/infra/parsers/sentry.parser.js';
import { AnthropicClient } from './shared/infra/llm/anthropic-client.js';
import { AnthropicAgentRunner } from './shared/infra/llm/anthropic-agent-runner.js';
import { AnthropicPTCAgentRunner } from './shared/infra/llm/anthropic-ptc-agent-runner.js';
import { AesGcmTokenEncryption } from './shared/infra/credentials/aes-gcm-token-encryption.js';
import { StubCloudProvider } from './shared/infra/cloud/stub-cloud-provider.js';
import { AWSCloudProvider } from './shared/infra/cloud/aws-cloud-provider.js';
import { AzureCloudProviderStub } from './shared/infra/cloud/azure-cloud-provider-stub.js';
import { STSCredentialVendor } from './shared/infra/credentials/sts-credential-vendor.js';
import type { LLMClient } from './shared/application/ports/llm-client.port.js';
import { GetCloudIntegrationUseCase } from './modules/integration/application/get-cloud-integration.usecase.js';
import { StubCredentialVendor } from './shared/infra/credentials/stub-credential-vendor.js';
import type { CredentialVendor } from './shared/application/ports/credential-vendor.port.js';
// SQSMessageQueue, DynamoEvidenceRepository, DynamoToolCallRepository — dynamically imported in AWS runtime block
import { TriageIncidentUseCase } from './modules/triage/application/triage-incident.usecase.js';
import { InvestigateIncidentUseCase } from './modules/investigation/application/investigate-incident.usecase.js';
import { DispatchInvestigationUseCase } from './modules/investigation/application/dispatch-investigation.usecase.js';
import { OrchestratorMode } from './modules/investigation/application/modes/orchestrator-mode.js';
import { HypothesisMode } from './modules/investigation/application/modes/hypothesis/index.js';
import { DebateMode } from './modules/investigation/application/modes/debate/index.js';
import { OrchestratorToolsetAdapter } from './modules/investigation/application/modes/shared/orchestrator-toolset.adapter.js';
import { InvestigationModeRegistry } from './modules/investigation/application/modes/registry.js';
import { DynamoHypothesisRepository } from './modules/investigation/infra/dynamo-hypothesis.repository.js';
import { ListHypothesesUseCase } from './modules/investigation/application/list-hypotheses.usecase.js';
import { GetInvestigationUseCase } from './modules/investigation/application/get-investigation.usecase.js';
import { createToolHandler } from './modules/investigation/infra/investigation-tools.js';
import { startTriageConsumer } from './modules/triage/infra/triage-consumer.js';
import { startInvestigationConsumer } from './modules/investigation/infra/investigation-consumer.js';
import { DynamoRemediationRepository } from './modules/remediation/infra/dynamo-remediation.repository.js';
import { ProposeRemediationUseCase } from './modules/remediation/application/propose-remediation.usecase.js';
import { ApproveRemediationUseCase } from './modules/remediation/application/approve-remediation.usecase.js';
import { RejectRemediationUseCase } from './modules/remediation/application/reject-remediation.usecase.js';
import { ExecuteRemediationUseCase } from './modules/remediation/application/execute-remediation.usecase.js';
import { RollbackRemediationUseCase } from './modules/remediation/application/rollback-remediation.usecase.js';
import { GetRemediationUseCase } from './modules/remediation/application/get-remediation.usecase.js';
import { WebPortalChatPlatform } from './shared/infra/chat/web-portal-chat-platform.js';
import { SSEManager } from './shared/infra/chat/sse-manager.js';
import { DynamoNotificationRepository } from './modules/notification/infra/dynamo-notification.repository.js';
import { DynamoApprovalRepository } from './modules/notification/infra/dynamo-approval.repository.js';
import { ListNotificationsUseCase } from './modules/notification/application/list-notifications.usecase.js';
import { ListPendingApprovalsUseCase } from './modules/notification/application/list-pending-approvals.usecase.js';
import { RespondApprovalUseCase } from './modules/notification/application/respond-approval.usecase.js';
import { MarkNotificationReadUseCase } from './modules/notification/application/mark-notification-read.usecase.js';
import type { NotificationUseCases } from './modules/notification/infra/notification.routes.js';
import { PgPushSubscriptionRepository } from './modules/notification/infra/pg-push-subscription.repository.js';
import { WebPushAdapter } from './modules/widget/infra/web-push.adapter.js';
import { DataMasker } from './modules/widget/application/data-masker.js';
import { ResponseFormatter } from './modules/widget/application/response-formatter.js';
import { FollowUpGenerator } from './modules/widget/application/follow-up-generator.js';
import { WidgetChatUseCase } from './modules/widget/application/widget-chat.usecase.js';
import { registerWidgetEventSubscribers } from './modules/widget/application/widget-event.subscriber.js';
import { startRemediationConsumer } from './modules/remediation/infra/remediation-consumer.js';
import { startProgressConsumer } from './shared/infra/pubsub/progress-consumer.js';
import { createObservabilityStack } from './shared/infra/observability/observability-factory.js';
import { ObservedAnthropicClient } from './shared/infra/llm/observed-anthropic-client.js';
import { ObservedAgentRunner } from './shared/infra/llm/observed-agent-runner.js';
import { HealthChecker } from './shared/infra/health/health-checker.js';
import { DynamoDBHealthCheck } from './shared/infra/health/checks/dynamodb-check.js';
import { RedisHealthCheck } from './shared/infra/health/checks/redis-check.js';
import { SQSHealthCheck } from './shared/infra/health/checks/sqs-check.js';
import { AnthropicHealthCheck } from './shared/infra/health/checks/anthropic-check.js';
import { CircuitBreaker } from './shared/infra/llm/circuit-breaker.js';
import { PostgresHealthCheck } from './shared/infra/health/checks/postgres-check.js';
import { QueuesHealthCheck } from './shared/infra/health/checks/queues-check.js';
import { getRedisClient } from './shared/infra/cache/redis-client.js';
import { DynamoApiKeyRepository } from './modules/tenant/infra/dynamo-api-key.repository.js';
import { configureAuthApiKeyRepo } from './shared/infra/http/middleware/auth.middleware.js';
import { CreateApiKeyUseCase } from './modules/tenant/application/create-api-key.usecase.js';
import { ListApiKeysUseCase } from './modules/tenant/application/list-api-keys.usecase.js';
import { RevokeApiKeyUseCase } from './modules/tenant/application/revoke-api-key.usecase.js';
import type { AgentRunner } from './shared/application/ports/agent-runner.port.js';
import { config } from './shared/config/index.js';
import { logger } from './shared/infra/logger.js';
import { tenantId, incidentId } from './shared/domain/value-objects.js';
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
import { CreateManualIncidentUseCase } from './modules/ingestion/application/create-manual-incident.usecase.js';
import { AddInvestigationContextUseCase } from './modules/investigation/application/add-investigation-context.usecase.js';
import { AbortInvestigationUseCase } from './modules/investigation/application/abort-investigation.usecase.js';
import { RespondKnownSolutionUseCase } from './modules/investigation/application/respond-known-solution.usecase.js';
import { RecordInvestigationFeedbackUseCase } from './modules/investigation/application/record-investigation-feedback.usecase.js';
import { ChatInvestigationUseCase } from './modules/investigation/application/chat-investigation.usecase.js';
import { InvestigationRegistry } from './modules/investigation/application/investigation-registry.js';
import { RecordRemediationFeedbackUseCase } from './modules/remediation/application/record-remediation-feedback.usecase.js';
// DynamoRunbookRegistryRepository — dynamically imported in AWS runtime block
import { HindsightAgentMemory } from './shared/infra/memory/hindsight-agent-memory.js';
import { ComposioToolProvider } from './shared/infra/integrations/composio-tool-provider.js';
import { ComposioTriggerService } from './shared/infra/integrations/composio-trigger-service.js';
import { DynamoTriggerRepository } from './modules/integration/infra/dynamo-trigger.repository.js';
import { ComposioWebhookValidator } from './modules/integration/infra/composio-webhook-validator.js';
import { CreateTriggerUseCase } from './modules/integration/application/create-trigger.usecase.js';
import { DeleteTriggerUseCase } from './modules/integration/application/delete-trigger.usecase.js';
import { ListTriggersUseCase } from './modules/integration/application/list-triggers.usecase.js';
import { HandleComposioWebhookUseCase } from './modules/integration/application/handle-composio-webhook.usecase.js';
import { ConnectCredentialUseCase } from './modules/integration/application/connect-credential.usecase.js';
import { DisconnectIntegrationUseCase } from './modules/integration/application/disconnect-integration.usecase.js';
import { ListAllIntegrationsUseCase } from './modules/integration/application/list-all-integrations.usecase.js';
import { ConnectSlackUseCase } from './modules/integration/application/connect-slack.usecase.js';
import { DisconnectSlackUseCase } from './modules/integration/application/disconnect-slack.usecase.js';
import { UpdateSlackConfigUseCase } from './modules/integration/application/update-slack-config.usecase.js';
import { DynamoSentryIntegrationRepository } from './modules/integration/infra/dynamo-sentry-integration.repository.js';
import { SaveSentryClientSecretUseCase } from './modules/integration/application/save-sentry-client-secret.usecase.js';
import { GetSentryIntegrationStatusUseCase } from './modules/integration/application/get-sentry-integration-status.usecase.js';
import { SlackNotificationRepository } from './modules/integration/infra/slack-notification.repository.js';
import { SlackNotificationSubscriber } from './shared/application/subscribers/slack-notification.subscriber.js';
import { FinalizeConnectionUseCase } from './modules/integration/application/finalize-connection.usecase.js';
import { DynamoBillingAccountRepository } from './modules/billing/infra/dynamo-billing-account.repository.js';
import { DynamoUsageRecordRepository } from './modules/billing/infra/dynamo-usage-record.repository.js';
import { StripeMeterEventService } from './modules/billing/infra/stripe-meter.service.js';
import { StripePlanCatalogService } from './modules/billing/infra/stripe-plan-catalog.service.js';
import { StripeCustomerService } from './modules/billing/infra/stripe-customer.service.js';
import { CreateCheckoutUseCase } from './modules/billing/application/create-checkout.usecase.js';
import { HandleWebhookUseCase as HandleBillingWebhookUseCase } from './modules/billing/application/handle-webhook.usecase.js';
import { GetCreditsUseCase } from './modules/billing/application/get-credits.usecase.js';
import { GetSubscriptionUseCase } from './modules/billing/application/get-subscription.usecase.js';
import { CreatePortalUseCase } from './modules/billing/application/create-portal.usecase.js';
import { SignupUseCase } from './modules/billing/application/signup.usecase.js';
import { PurchaseQuotaPackUseCase } from './modules/billing/application/purchase-quota-pack.usecase.js';
import { UpdateBillingSettingsUseCase } from './modules/billing/application/update-billing-settings.usecase.js';
import { GetUsageUseCase } from './modules/billing/application/get-usage.usecase.js';
import { ReserveInvestigationUseCase } from './modules/billing/application/reserve-investigation.usecase.js';
import { RecordUsageUseCase } from './modules/billing/application/record-usage.usecase.js';
import { ListPlansUseCase } from './modules/billing/application/list-plans.usecase.js';
import { UpgradeSubscriptionUseCase } from './modules/billing/application/upgrade-subscription.usecase.js';
import { CancelSubscriptionUseCase } from './modules/billing/application/cancel-subscription.usecase.js';
import { CreateSubscriptionUseCase } from './modules/billing/application/create-subscription.usecase.js';
import { ReactivateSubscriptionUseCase } from './modules/billing/application/reactivate-subscription.usecase.js';
import { ListInvoicesUseCase } from './modules/billing/application/list-invoices.usecase.js';
import type { HandleClerkWebhookUseCase } from './modules/auth/application/handle-clerk-webhook.usecase.js';
import { DynamoUserRepository } from './modules/user/infra/dynamo-user.repository.js';
import { DynamoInviteRepository } from './modules/user/infra/dynamo-invite.repository.js';
import { CreateUserUseCase } from './modules/user/application/create-user.usecase.js';
import { ListUsersUseCase } from './modules/user/application/list-users.usecase.js';
import { UpdateUserUseCase } from './modules/user/application/update-user.usecase.js';
import { DeleteUserUseCase } from './modules/user/application/delete-user.usecase.js';
import type { CreateInviteUseCase } from './modules/user/application/create-invite.usecase.js';
import { ListInvitesUseCase } from './modules/user/application/list-invites.usecase.js';
import { RevokeInviteUseCase } from './modules/user/application/revoke-invite.usecase.js';
import { GetSettingsUseCase } from './modules/user/application/get-settings.usecase.js';
import { UpdateSettingsUseCase } from './modules/user/application/update-settings.usecase.js';
import { GetUserByEmailUseCase } from './modules/user/application/get-user-by-email.usecase.js';
import { AcceptInviteUseCase } from './modules/user/application/accept-invite.usecase.js';
import { ChatUseCase } from './modules/memory/application/chat.usecase.js';
// DynamoChatHistoryRepository — dynamically imported in AWS runtime block
// DynamoCodeKnowledgeRepository — dynamically imported in AWS runtime block
import { StaticCodeRepository } from './shared/infra/code-repository/static-code-repository.js';
import { IndexRepositoryUseCase } from './modules/code-intelligence/application/index-repository.usecase.js';
import { SuggestRepoMappingUseCase } from './modules/code-intelligence/application/suggest-repo-mapping.usecase.js';
import type { CodeKnowledgeUseCases } from './modules/code-intelligence/infra/code-knowledge.routes.js';
import type { IRelayGateway } from './shared/application/ports/relay-gateway.port.js';
import type { RemediationId } from './shared/domain/value-objects.js';
import type { StructuredAction, ProposedFix } from './modules/investigation/domain/investigation.types.js';
import type { BillingUseCases } from './modules/billing/infra/billing.routes.js';
import type { WidgetRouteDeps } from './modules/widget/infra/widget.routes.js';
import type { TriggerUseCases, ComposioWebhookDeps } from './modules/integration/infra/trigger.routes.js';
import type { IntegrationUseCases } from './modules/integration/infra/integration.routes.js';
import type { AuthUseCases } from './modules/auth/infra/auth.routes.js';
import type { UserUseCases } from './modules/user/infra/user.routes.js';
import type { MemoryUseCases } from './modules/memory/infra/memory.routes.js';
import { CreateSkillUseCase, ListSkillsUseCase, GetSkillUseCase, UpdateSkillUseCase, DeleteSkillUseCase } from './modules/skills/application/crud-skills.usecase.js';
import { SelectSkillsUseCase } from './modules/skills/application/select-skills.usecase.js';
import { createSkillRoutes } from './modules/skills/infra/skill.routes.js';
import type { Hono } from 'hono';
import type { AppEnv } from './shared/infra/http/hono-types.js';

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
  relayGateway?: IRelayGateway;
  sseManager: SSEManager;
  healthChecker: HealthChecker;
  consumers: ConsumerHandle[];
  corsOrigins: string[];
  billingUseCases: BillingUseCases;
  widgetUseCases?: WidgetRouteDeps;
  triggerUseCases?: TriggerUseCases;
  integrationUseCases: IntegrationUseCases;
  skillRoutes?: Hono<AppEnv>;
  betaAllowlistRoutes?: Hono<AppEnv>;
  composioWebhookDeps?: ComposioWebhookDeps;
  authUseCases: AuthUseCases;
  userUseCases: UserUseCases;
  memoryUseCases: MemoryUseCases;
  /** OSS runtime auth router (register + login), undefined in AWS runtime */
  ossAuthRouter?: Hono<AppEnv>;
}

export interface BootstrapOverrides {
  llmClient?: LLMClient;
  agentRunner?: AgentRunner;
  relayGateway?: IRelayGateway;
}

export async function bootstrap(overrides?: BootstrapOverrides): Promise<AppContext> {
  // Shared
  const eventBus = new EventBus();
  eventBus.setErrorLogger((eventType, err) => {
    logger.error({ err, eventType }, 'EventBus handler error');
  });
  const providerRegistry = new ProviderRegistry();
  // AC-041: In the OSS runtime, BullMQ on Redis replaces SQS.
  // The AWS runtime keeps the original SQSMessageQueue.
  const messageQueue = config.isOss()
    ? new (await import('./shared/infra/queue/bull-mq-message-queue.js')).BullMqMessageQueue()
    : new (await import('./shared/infra/queue/sqs-message-queue.js')).SQSMessageQueue();

  // Resolve queue identifiers — BullMQ queue names in OSS runtime, SQS URLs
  // in the AWS runtime (AC-041). These are passed to use cases that need to
  // enqueue work downstream (triage → investigation → remediation).
  const alertQueueUrl = config.isOss() ? config.bullmq.alertQueueName : config.sqs.alertQueueUrl;
  const triageQueueUrl = config.isOss() ? config.bullmq.triageQueueName : config.sqs.alertQueueUrl;
  const investigationQueueUrl = config.isOss() ? config.bullmq.investigationQueueName : config.sqs.investigationQueueUrl;
  const remediationQueueUrl = config.isOss() ? config.bullmq.remediationQueueName : config.sqs.remediationQueueUrl;

  // Register Alert Parsers
  const datadogParser = new DatadogParser();
  const grafanaParser = new GrafanaParser();
  const cloudwatchParser = new CloudWatchParser();
  const sentryParser = new SentryParser();
  providerRegistry.registerAlertParser(datadogParser.source, datadogParser);
  providerRegistry.registerAlertParser(grafanaParser.source, grafanaParser);
  providerRegistry.registerAlertParser(cloudwatchParser.source, cloudwatchParser);
  providerRegistry.registerAlertParser(sentryParser.source, sentryParser);

  // === Repositories (runtime-aware) ===
  //
  // OSS runtime (CAUSEFLOW_RUNTIME=oss): Postgres repositories with JSONB
  // storage (AC-040). No DynamoDBClient is instantiated.
  //
  // AWS runtime: original ElectroDB / DynamoDB repositories (unchanged).
  //
  // Variables typed as interfaces so dynamic import works cleanly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenantRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auditRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let incidentRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let evidenceRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toolCallRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let codeKnowledgeRepo: any;

  if (config.isOss()) {
    logger.info('Bootstrap: using Postgres repositories (OSS runtime)');
    const { PgTenantRepository } = await import('./modules/tenant/infra/pg-tenant.repository.js');
    const { PgAuditRepository } = await import('./modules/audit/infra/pg-audit.repository.js');
    const { PgIncidentRepository } = await import('./modules/ingestion/infra/pg-incident.repository.js');
    tenantRepo = new PgTenantRepository();
    auditRepo = new PgAuditRepository();
    incidentRepo = new PgIncidentRepository();
    const { PgEvidenceRepository } = await import('./modules/triage/infra/pg-evidence.repository.js');
    const { PgToolCallRepository } = await import('./modules/triage/infra/pg-tool-call.repository.js');
    const { PgCodeKnowledgeRepository } = await import('./modules/code-intelligence/infra/pg-code-knowledge.repository.js');
    evidenceRepo = new PgEvidenceRepository();
    toolCallRepo = new PgToolCallRepository();
    codeKnowledgeRepo = new PgCodeKnowledgeRepository();
  } else {
    logger.info('Bootstrap: using DynamoDB repositories (AWS runtime)');
    tenantRepo = new DynamoTenantRepository();
    auditRepo = new DynamoAuditRepository();
    incidentRepo = new DynamoIncidentRepository();
    const { DynamoEvidenceRepository: DynamoEvidenceRepo } = await import('./modules/triage/infra/dynamo-evidence.repository.js');
    const { DynamoToolCallRepository: DynamoToolCallRepo } = await import('./modules/triage/infra/dynamo-tool-call.repository.js');
    const { DynamoCodeKnowledgeRepository: DynamoCodeKnowledgeRepo } = await import('./modules/code-intelligence/infra/dynamo-code-knowledge.repository.js');
    evidenceRepo = new DynamoEvidenceRepo();
    toolCallRepo = new DynamoToolCallRepo();
    codeKnowledgeRepo = new DynamoCodeKnowledgeRepo();
  }

  // Observability Stack
  const { tracer, metrics } = await createObservabilityStack();

  // AC-022: Shared circuit breaker for Anthropic health + LLM calls in OSS runtime.
  const anthropicCircuitBreaker = new CircuitBreaker(
    config.isOss() ? { failureThreshold: 1, resetTimeoutMs: 60_000 } : { failureThreshold: 5, resetTimeoutMs: 60_000 },
  );

  // LLM Client + Agent Runner (wrapped with observability decorators)
  const rawLlmClient = overrides?.llmClient ?? (() => {
    const client = new AnthropicClient();
    client.setCircuitBreaker(anthropicCircuitBreaker);
    return client;
  })();
  const rawAgentRunner = overrides?.agentRunner
    ?? (config.ptc.enabled ? new AnthropicPTCAgentRunner() : new AnthropicAgentRunner());
  const llmClient = new ObservedAnthropicClient(rawLlmClient, tracer, metrics);
  const agentRunner = new ObservedAgentRunner(rawAgentRunner, tracer, metrics);

  // Token Encryption — KMS envelope encryption (AWS) or AES-256-GCM (OSS).
  // AC-044: In the OSS runtime, use Node's built-in crypto instead of KMS.
  // AC-040: No AWS SDK client is instantiated at boot in OSS mode.
  const tokenEncryption = new AesGcmTokenEncryption();

  // Sentry Integration Repository + Use Cases (envelope-encrypted Client Secret)
  const sentryIntegrationRepo = new DynamoSentryIntegrationRepository(tokenEncryption);
  const saveSentryClientSecret = new SaveSentryClientSecretUseCase(tokenEncryption, sentryIntegrationRepo);
  const getSentryIntegrationStatus = new GetSentryIntegrationStatusUseCase(sentryIntegrationRepo);

  // Cloud Provider (AWS real in prod, Stub in dev)
  const cloudProvider = config.isProd() || config.sts.roleArn
    ? new AWSCloudProvider()
    : new StubCloudProvider();
  providerRegistry.registerCloudProvider('aws', cloudProvider);
  // AC-040: Skip Azure stub in OSS runtime — no cloud provider registrations
  // that imply a non-local runtime are added when running in OSS mode.
  if (!config.isOss()) {
    providerRegistry.registerCloudProvider('azure', new AzureCloudProviderStub());
  }

  // Credential Vendor (STS in prod, Stub in dev)
  const getCloudIntegration = new GetCloudIntegrationUseCase(tokenEncryption);
  const credentialVendor: CredentialVendor = config.isDev() || config.isTest()
    ? new StubCredentialVendor()
    : new STSCredentialVendor(undefined, tenantRepo, getCloudIntegration);
  providerRegistry.registerCredentialVendor(credentialVendor);

  // Tenant Use Cases
  const tenantUseCases: TenantUseCases = {
    createTenant: new CreateTenantUseCase(tenantRepo, eventBus),
    getTenant: new GetTenantUseCase(tenantRepo),
    updateTenant: new UpdateTenantUseCase(tenantRepo, eventBus),
    listTenants: new ListTenantsUseCase(tenantRepo),
  };

  // Audit Use Cases
  const createAuditEntry = new CreateAuditEntryUseCase(auditRepo);
  // In OSS mode, the user email resolver is not needed (no Clerk).
  // The ListAuditEntriesUseCase handles undefined resolver gracefully.
  const userEmailResolver = config.isOss()
    ? undefined
    : new (await import('./modules/audit/infra/clerk-user-email-resolver.js')).ClerkUserEmailResolver();
  const auditUseCases: AuditUseCases = {
    listAuditEntries: new ListAuditEntriesUseCase(auditRepo, userEmailResolver),
    verifyHashChain: new VerifyHashChainUseCase(auditRepo),
    exportAudit: new ExportAuditUseCase(auditRepo),
    createAuditEntry,
    deleteAuditEntry: new DeleteAuditEntryUseCase(auditRepo, createAuditEntry),
  };

  // Reserve/Refund — needed by ingestion routes (created early, before billing block)
  const billingAccountRepoEarly = config.isOss()
    ? new (await import('./modules/billing/infra/pg-billing-account.repository.js')).PgBillingAccountRepository()
    : new DynamoBillingAccountRepository();
  const stripeMeterServiceEarly = config.stripe.secretKey ? new StripeMeterEventService() : undefined;
  const reserveInvestigation = new ReserveInvestigationUseCase(billingAccountRepoEarly, stripeMeterServiceEarly, tenantRepo);

  // Ingestion Use Cases
  const webhookUseCases: WebhookUseCases = {
    ingestAlert: new IngestAlertUseCase(
      incidentRepo,
      eventBus,
      providerRegistry,
      messageQueue,
      triageQueueUrl,
    ),
    reserveInvestigation,
    sentryIntegrationRepo,
  };

  const createManualIncident = new CreateManualIncidentUseCase(
    incidentRepo,
    eventBus,
    messageQueue,
    triageQueueUrl,
    investigationQueueUrl,
  );

  const incidentUseCases: IncidentUseCases = {
    getIncident: new GetIncidentUseCase(incidentRepo),
    listIncidents: new ListIncidentsUseCase(incidentRepo),
    updateIncidentStatus: new UpdateIncidentStatusUseCase(incidentRepo, eventBus),
    updateIncidentSeverity: new UpdateIncidentSeverityUseCase(incidentRepo, eventBus),
    createManualIncident,
    incidentRepo,
    reserveInvestigation,
  };

  // Triage Use Cases
  const triageIncident = new TriageIncidentUseCase({
    incidentRepo,
    evidenceRepo,
    eventBus,
    llmClient,
    tracer,
    messageQueue,
    investigationQueueUrl,
    minInvestigationSeverity: config.triage.minInvestigationSeverity,
    updateIncidentStatus: incidentUseCases.updateIncidentStatus,
  });
  const triageUseCases: TriageUseCases = {
    triageIncident,
    evidenceRepo,
    incidentRepo,
  };


  // Code Knowledge Use Cases — uses StaticCodeRepository for local dev (no GitHub credentials)
  const staticCodeRepo = new StaticCodeRepository();
  const indexRepository = new IndexRepositoryUseCase(codeKnowledgeRepo, () => staticCodeRepo, eventBus);
  const suggestRepoMapping = new SuggestRepoMappingUseCase(codeKnowledgeRepo);

  const codeKnowledgeUseCases: CodeKnowledgeUseCases = {
    codeKnowledgeRepo,
    suggestRepoMapping,
    indexRepository,
  };

  // Composio Integration
  const composioToolProvider = config.composio.apiKey
    ? new ComposioToolProvider()
    : undefined;

  // Core dependencies (Hindsight + RunbookRegistry)
  // AC-040: PgRunbookRegistryRepository in OSS runtime, Dynamo in AWS runtime
  const runbookRegistry = await (async () => {
    if (config.isOss()) {
      const { PgRunbookRegistryRepository } = await import('./shared/infra/db/pg-runbook-registry.repository.js');
      return new PgRunbookRegistryRepository();
    }
    const { DynamoRunbookRegistryRepository } = await import('./shared/infra/db/dynamo-runbook-registry.repository.js');
    return new DynamoRunbookRegistryRepository();
  })();
  const agentMemory = new HindsightAgentMemory({ baseUrl: config.hindsight.baseUrl, apiKey: config.hindsight.apiKey });

  // Skills (per-tenant investigation runbooks / escalation paths)
  // AC-027: PgSkillRepository in OSS runtime, Dynamo in AWS runtime
  const skillRepo = await (async () => {
    if (config.isOss()) {
      const { PgSkillRepository } = await import('./modules/skills/infra/pg-skill.repository.js');
      return new PgSkillRepository();
    }
    const { DynamoSkillRepository } = await import('./modules/skills/infra/dynamo-skill.repository.js');
    return new DynamoSkillRepository();
  })();
  const selectSkills = new SelectSkillsUseCase(skillRepo, llmClient);

  const hypothesisRepo = config.isOss()
    ? new (await import('./modules/investigation/infra/pg-hypothesis.repository.js')).PgHypothesisRepository()
    : new DynamoHypothesisRepository();

  // Investigation Use Cases
  const investigateIncident = new InvestigateIncidentUseCase({
    incidentRepo,
    evidenceRepo,
    toolCallRepo,
    eventBus,
    agentRunner,
    llmClient,
    cloudProvider,
    credentialVendor,
    toolHandlerFactory: createToolHandler,
    messageQueue,
    remediationQueueUrl,
    defaultRegion: config.aws.region,
    synthesisModel: config.anthropic.synthesisModel,
    relayGateway: overrides?.relayGateway,
    integrationToolProvider: composioToolProvider,
    agentMemory,
    selectSkills,
    hypothesisRepo,
  });
  const getInvestigation = new GetInvestigationUseCase(incidentRepo, evidenceRepo);
  const addInvestigationContext = new AddInvestigationContextUseCase({
    incidentRepo,
    evidenceRepo,
    eventBus,
    messageQueue,
    investigationQueueUrl,
  });
  // Investigation mode registry — pluggable reasoning strategies.
  // Orchestrator is default; hypothesis-driven mode is available for staff
  // to toggle via the admin endpoint without a deploy.
  const orchestratorMode = new OrchestratorMode(investigateIncident);
  const toolsetAdapter = new OrchestratorToolsetAdapter(investigateIncident);
  const hypothesisMode = new HypothesisMode({
    toolset: toolsetAdapter,
    hypothesisRepo,
    incidentRepo,
    evidenceRepo,
    eventBus,
    agentRunner,
    llmClient,
    cloudProvider,
    credentialVendor,
    toolHandlerFactory: createToolHandler,
    integrationToolProvider: composioToolProvider,
    relayGateway: overrides?.relayGateway,
    agentMemory,
    seekerModel: config.anthropic.seekerModel,
    seekerColdStartModel: config.anthropic.seekerColdStartModel,
    validatorModel: config.anthropic.agentModels.orchestrator,
    judgeModel: config.anthropic.synthesisModel,
    metrics,
  });
  const debateMode = new DebateMode({
    toolset: toolsetAdapter,
    hypothesisRepo,
    incidentRepo,
    evidenceRepo,
    eventBus,
    agentRunner,
    llmClient,
    cloudProvider,
    credentialVendor,
    toolHandlerFactory: createToolHandler,
    integrationToolProvider: composioToolProvider,
    relayGateway: overrides?.relayGateway,
    agentMemory,
    seekerModel: config.anthropic.seekerModel,
    seekerColdStartModel: config.anthropic.seekerColdStartModel,
    advocateModel: config.anthropic.agentModels.orchestrator,
    prosecutorModel: config.anthropic.agentModels.orchestrator,
    judgeModel: config.anthropic.synthesisModel,
    metrics,
  });
  const modeRegistry = new InvestigationModeRegistry([orchestratorMode, hypothesisMode, debateMode]);
  const dispatchInvestigation = new DispatchInvestigationUseCase({
    incidentRepo,
    registry: modeRegistry,
    metrics,
  });
  const investigationRegistry = new InvestigationRegistry();
  const abortInvestigation = new AbortInvestigationUseCase(incidentRepo, eventBus, investigationRegistry);
  const respondKnownSolution = new RespondKnownSolutionUseCase(incidentRepo, eventBus, runbookRegistry);
  const recordInvestigationFeedback = new RecordInvestigationFeedbackUseCase(eventBus, agentMemory, runbookRegistry);

  // Notification + chat platform (needed by investigation chat mirroring — AC-021)
  const sseManager = new SSEManager();
  const notificationRepo = config.isOss()
    ? new (await import('./modules/notification/infra/pg-notification.repository.js')).PgNotificationRepository()
    : new DynamoNotificationRepository();
  const approvalRepo = config.isOss()
    ? new (await import('./modules/notification/infra/pg-approval.repository.js')).PgApprovalRepository()
    : new DynamoApprovalRepository();
  const chatPlatform = new WebPortalChatPlatform(notificationRepo, approvalRepo, sseManager);
  const slackNotificationRepo = new SlackNotificationRepository();

  const chatInvestigation = new ChatInvestigationUseCase({
    incidentRepo, evidenceRepo, agentRunner, agentMemory,
    llmClient: llmClient as unknown as LLMClient,
    chatHistory: config.isOss()
      ? new (await import('./modules/memory/infra/pg-chat-history.repository.js')).PgChatHistoryRepository()
      : new (await import('./modules/memory/infra/dynamo-chat-history.repository.js')).DynamoChatHistoryRepository(),
    chatPlatform,
    tenantRepo,
    tokenEncryption,
    slackNotificationRepo,
    addInvestigationContext,
    dispatchFollowupWorker: config.ecs.cluster
      ? async (iid, tid) => {
          const { dispatchInvestigation } = await import('./shared/infra/investigation/ecs-task-dispatcher.js');
          await dispatchInvestigation({ incidentId: iid, tenantId: tid, suggestedAgents: [], mode: 'followup' });
        }
      : config.isOss()
        ? async (iid, tid) => {
            const { dispatchInvestigation } = await import('./shared/infra/investigation/local-task-dispatcher.js');
            await dispatchInvestigation({ incidentId: iid, tenantId: tid, suggestedAgents: [], mode: 'followup' });
          }
        : undefined,
  });
  const listHypotheses = new ListHypothesesUseCase(hypothesisRepo);
  const investigationUseCases: InvestigationUseCases = {
    investigateIncident: dispatchInvestigation,
    getInvestigation,
    addInvestigationContext,
    abortInvestigation,
    respondKnownSolution,
    recordInvestigationFeedback,
    chatInvestigation,
    listHypotheses,
    evidenceRepo,
    toolCallRepo,
    incidentRepo,
    sseManager,
  };

  // Remediation Use Cases — OSS runtime uses Postgres, AWS runtime uses DynamoDB
  const remediationRepo = config.isOss()
    ? new (await import('./modules/remediation/infra/pg-remediation.repository.js')).PgRemediationRepository()
    : new DynamoRemediationRepository();

  const proposeRemediation = new ProposeRemediationUseCase(
    remediationRepo,
    incidentRepo,
    eventBus,
    chatPlatform,
  );
  const approveRemediation = new ApproveRemediationUseCase(remediationRepo, eventBus, approvalRepo);
  const rejectRemediation = new RejectRemediationUseCase(remediationRepo, incidentRepo, eventBus);
  const executeRemediation = new ExecuteRemediationUseCase(
    remediationRepo,
    incidentRepo,
    eventBus,
    cloudProvider,
    credentialVendor,
  );
  const rollbackRemediation = new RollbackRemediationUseCase(remediationRepo, eventBus);
  const getRemediation = new GetRemediationUseCase(remediationRepo);

  const recordRemediationFeedback = new RecordRemediationFeedbackUseCase(eventBus, agentMemory);
  const remediationUseCases: RemediationUseCases = {
    proposeRemediation,
    approveRemediation,
    rejectRemediation,
    executeRemediation,
    rollbackRemediation,
    getRemediation,
    recordRemediationFeedback,
  };

  // Composio Triggers + Integration Use Cases
  const triggerRepo = new DynamoTriggerRepository();
  const composioTriggerService = new ComposioTriggerService();

  const createTrigger = new CreateTriggerUseCase(triggerRepo, composioTriggerService, eventBus);
  const deleteTrigger = new DeleteTriggerUseCase(triggerRepo, composioTriggerService, eventBus);
  const listTriggers = new ListTriggersUseCase(triggerRepo);

  const triggerUseCases: TriggerUseCases | undefined = config.composio.apiKey
    ? { createTrigger, deleteTrigger, listTriggers, composioTriggerService }
    : undefined;

  const composioWebhookDeps: ComposioWebhookDeps | undefined = config.composio.apiKey
    ? {
        handleComposioWebhook: new HandleComposioWebhookUseCase(
          new ComposioWebhookValidator(config.composio.webhookSecret),
          triggerRepo,
          webhookUseCases.ingestAlert,
          eventBus,
        ),
      }
    : undefined;

  const connectCredential = new ConnectCredentialUseCase(tokenEncryption, eventBus);
  const disconnectIntegration = new DisconnectIntegrationUseCase(eventBus);
  const listAllIntegrations = new ListAllIntegrationsUseCase();

  // Slack integration
  const slackOAuthConfig = {
    clientId: config.slack.clientId,
    clientSecret: config.slack.clientSecret,
    redirectUri: config.slack.redirectUri,
  };
  const connectSlack = new ConnectSlackUseCase(tenantRepo, slackOAuthConfig, tokenEncryption);
  const disconnectSlack = new DisconnectSlackUseCase(tenantRepo, tokenEncryption);
  const updateSlackConfig = new UpdateSlackConfigUseCase(tenantRepo);
  const slackDeps = {
    connectSlack,
    disconnectSlack,
    updateSlackConfig,
    tenantRepo,
    slackConfig: {
      clientId: config.slack.clientId,
      clientSecret: config.slack.clientSecret,
      redirectUri: config.slack.redirectUri,
      stateSecret: config.slack.stateSecret,
      signingSecret: config.slack.signingSecret,
    },
    tokenEncryption,
  };

  const finalizeConnection = new FinalizeConnectionUseCase(eventBus);
  const integrationUseCases: IntegrationUseCases = {
    connectCredential,
    disconnectIntegration,
    listAllIntegrations,
    getCloudIntegration,
    composioToolProvider,
    slackDeps,
    finalizeConnection,
    saveSentryClientSecret,
    getSentryIntegrationStatus,
    composioRouteDeps: config.composio.apiKey
      ? { composioToolProvider, createTrigger, composioTriggerService }
      : undefined,
  };

  // Billing Use Cases (reuse early billing repo)
  // AC-043: In the OSS runtime, Stripe-dependent use cases are omitted entirely
  // so no Stripe SDK is loaded, no stripe.com call is ever made, and routes that
  // depend on them return 410 Gone. The plan catalog is not instantiated to avoid
  // pulling in the Stripe SDK at module evaluation time.
  const billingAccountRepo = billingAccountRepoEarly;
  const usageRecordRepo = config.isOss()
    ? new (await import('./modules/billing/infra/pg-usage-record.repository.js')).PgUsageRecordRepository()
    : new DynamoUsageRecordRepository();

  let billingUseCases: BillingUseCases;

  if (config.isOss()) {
    // OSS runtime: only usage records are supported (no Stripe dependency).
    // The routes handle missing use cases gracefully:
    // - GET /v1/billing/subscription  → { plan:'free', status:'active' }
    // - POST /v1/billing/checkout     → 410 Gone
    // - POST /v1/billing/portal       → 410 Gone
    // - GET /v1/billing/usage         → works (uses PgUsageRecordRepository)
    // - POST /v1/billing/webhook      → not mounted (skipped in app.ts for OSS)
    billingUseCases = {
      getUsage: new GetUsageUseCase(billingAccountRepo, usageRecordRepo),
    };
  } else {
    const planCatalog = new StripePlanCatalogService();
    const stripeCustomerService = config.stripe.secretKey ? new StripeCustomerService() : undefined;

    billingUseCases = {
      createCheckout: new CreateCheckoutUseCase(tenantRepo, planCatalog),
      createPortal: new CreatePortalUseCase(tenantRepo),
      getSubscription: new GetSubscriptionUseCase(tenantRepo, billingAccountRepo, planCatalog),
      handleWebhook: new HandleBillingWebhookUseCase(tenantRepo, planCatalog, billingAccountRepo),
      getUsage: new GetUsageUseCase(billingAccountRepo, usageRecordRepo),
      getCredits: new GetCreditsUseCase(billingAccountRepo),
      signup: new SignupUseCase(tenantRepo, billingAccountRepo, eventBus, planCatalog),
      purchaseQuotaPack: new PurchaseQuotaPackUseCase(billingAccountRepo, tenantRepo, planCatalog),
      updateBillingSettings: new UpdateBillingSettingsUseCase(billingAccountRepo),
      listPlans: new ListPlansUseCase(planCatalog),
      upgradeSubscription: new UpgradeSubscriptionUseCase(tenantRepo, planCatalog, billingAccountRepo),
      listInvoices: new ListInvoicesUseCase(tenantRepo),
      cancelSubscription: new CancelSubscriptionUseCase(tenantRepo),
      reactivateSubscription: new ReactivateSubscriptionUseCase(tenantRepo),
      createSubscription: new CreateSubscriptionUseCase(tenantRepo, planCatalog),
    };
  }

  // Auth Use Cases
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inviteRepo: any;
  let authUseCases: AuthUseCases;
  let ossAuthRouter: Hono<AppEnv> | undefined;

  if (config.isOss()) {
    const { PgUserRepository } = await import('./modules/user/infra/pg-user.repository.js');
    userRepo = new PgUserRepository();
    inviteRepo = new DynamoInviteRepository(); // Not yet implemented as Postgres
    // In OSS mode, the Clerk webhook handler is never invoked (ossAuthRouter
    // replaces auth.routes entirely). We provide a no-op stub that satisfies
    // the AuthUseCases type without importing @clerk/backend at boot time.
    authUseCases = {
      handleClerkWebhook: {
        execute: async (_body: string, _headers: Record<string, string>) => {
          // Clerk webhook disabled in OSS runtime
        },
      } as unknown as HandleClerkWebhookUseCase,
    };
  } else {
    userRepo = new DynamoUserRepository();
    inviteRepo = new DynamoInviteRepository();
    const { HandleClerkWebhookUseCase: HCW } = await import('./modules/auth/application/handle-clerk-webhook.usecase.js');
    // Use statically-imported Stripe classes (already loaded at top of file).
    // These are only used in the non-OSS branch where Stripe is configured.
    const clerkPlanCatalog = new StripePlanCatalogService();
    const clerkStripeCustomer = config.stripe.secretKey ? new StripeCustomerService() : undefined;
    authUseCases = {
      handleClerkWebhook: new HCW(tenantRepo, userRepo, clerkStripeCustomer, clerkPlanCatalog, billingAccountRepo),
    };
  }

  // User Use Cases
  // CreateInviteUseCase dynamically imported to avoid pulling in @clerk/backend
  // at module evaluation time in OSS mode (even though the route is not mounted,
  // the static import would still load clerk-client.ts -> @clerk/backend).
  const { CreateInviteUseCase: CInv } = await import('./modules/user/application/create-invite.usecase.js');
  const userUseCases: UserUseCases = {
    createUser: new CreateUserUseCase(userRepo, eventBus),
    listUsers: new ListUsersUseCase(userRepo),
    updateUser: new UpdateUserUseCase(userRepo, eventBus),
    deleteUser: new DeleteUserUseCase(userRepo, eventBus),
    createInvite: new CInv(inviteRepo, eventBus),
    listInvites: new ListInvitesUseCase(inviteRepo),
    revokeInvite: new RevokeInviteUseCase(inviteRepo, eventBus),
    getSettings: new GetSettingsUseCase(userRepo, tenantRepo),
    updateSettings: new UpdateSettingsUseCase(userRepo, tenantRepo),
    getUserByEmail: new GetUserByEmailUseCase(userRepo),
    acceptInvite: new AcceptInviteUseCase(inviteRepo, userRepo, eventBus),
  };

  // Memory Use Cases (Hindsight-backed)
  const chatHistoryRepo = config.isOss()
    ? new (await import('./modules/memory/infra/pg-chat-history.repository.js')).PgChatHistoryRepository()
    : new (await import('./modules/memory/infra/dynamo-chat-history.repository.js')).DynamoChatHistoryRepository();
  const memoryUseCases: MemoryUseCases = {
    agentMemory,
    runbookRegistry,
    chatHistory: chatHistoryRepo,
    chat: new ChatUseCase({
      agentRunner,
      llmClient,
      cloudProvider,
      credentialVendor,
      agentMemory,
      incidentRepo,
      eventBus,
      sseManager,
      toolHandlerFactory: createToolHandler,
      messageQueue,
      investigationQueueUrl,
      defaultRegion: config.aws.region,
      chatHistory: chatHistoryRepo,
      reserveInvestigation,
    }),
  };

  // Notification Use Cases
  const listNotifications = new ListNotificationsUseCase(notificationRepo);
  const listPendingApprovals = new ListPendingApprovalsUseCase(approvalRepo);
  const respondApproval = new RespondApprovalUseCase(approvalRepo, eventBus, {
    onApprove: async (approval) => {
      if (approval.remediationId) {
        await approveRemediation.execute({
          tenantId: approval.tenantId,
          remediationId: approval.remediationId,
          approvedBy: approval.respondedBy ?? 'web-portal',
        });
      }
    },
    onReject: async (approval) => {
      if (approval.remediationId) {
        await rejectRemediation.execute({
          tenantId: approval.tenantId,
          remediationId: approval.remediationId,
          rejectedBy: approval.respondedBy ?? 'web-portal',
          reason: `Rejected via web portal: ${approval.selectedAction ?? 'reject'}`,
        });
      }
    },
  });
  const markNotificationRead = new MarkNotificationReadUseCase(notificationRepo);

  // Push subscription repository and Web Push adapter (VAPID)
  let pushSubscriptionRepo: import('./modules/notification/domain/push-subscription.repository.js').IPushSubscriptionRepository | undefined;
  let pushAdapter: WebPushAdapter | undefined;

  if (config.isOss()) {
    // OSS runtime: use Postgres-based repository
    pushSubscriptionRepo = new PgPushSubscriptionRepository();
  }

  if (config.webPush.keys.publicKey && config.webPush.keys.privateKey) {
    pushAdapter = new WebPushAdapter(
      config.webPush.keys.publicKey,
      config.webPush.keys.privateKey,
      config.webPush.subject,
    );
  }

  const notificationUseCases: NotificationUseCases = {
    listNotifications,
    listPendingApprovals,
    respondApproval,
    markNotificationRead,
    notificationRepo,
    sseManager,
    pushSubscriptionRepo,
  };

  // === EventBus Wiring: Audit Trail ===
  eventBus.subscribe('incident.created', async (event) => {
    const actor = resolveIncidentCreatedActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'incident.created',
      actorType: actor.actorType,
      ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
      actorEmail: actor.actorEmail,
      resourceType: 'incident',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
    });

    // Fire severity_changed for initial severity assignment so push
    // subscribers receive a notification at incident creation time (AC-033).
    const incId = (event.payload['incidentId'] as string) ?? '';
    const sev = (event.payload['severity'] as string) ?? '';
    const title = (event.payload['title'] as string) ?? 'Incident';
    if (incId && sev) {
      await eventBus.publish({
        eventType: 'incident.severity_changed',
        occurredAt: new Date().toISOString(),
        tenantId: event.tenantId,
        payload: {
          incidentId: incId,
          severity: sev,
          previousSeverity: 'unset',
          title,
        },
      });
    }
  });

  eventBus.subscribe('incident.status_changed', async (event) => {
    const actor = resolveIncidentStatusChangedActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'incident.status_changed',
      actorType: actor.actorType,
      ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
      actorEmail: actor.actorEmail,
      resourceType: 'incident',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
    });

    // Note: push notifications are sent via the incident.severity_changed handler below.
    // We intentionally do NOT send push on every status transition — only on severity changes.
  });

  // Push notification handler for incident severity changes (AC-033).
  // Fires when an incident severity is explicitly changed or set at creation.
  eventBus.subscribe('incident.severity_changed', async (event) => {
    if (!pushSubscriptionRepo || !pushAdapter) return;
    try {
      const tid = tenantId(event.tenantId);
      const payload = event.payload as Record<string, unknown>;
      const incidentId = (payload['incidentId'] as string) ?? '';
      const incidentTitle = (payload['title'] as string) ?? 'Incident updated';

      const subscriptions = await pushSubscriptionRepo.listByTenant(tid);
      if (subscriptions.length > 0) {
        const pushPayload = {
          title: incidentTitle,
          body: `Incident severity changed: ${incidentTitle}`,
          url: `/dashboard/incidents/${incidentId}`,
          data: { incidentId, severity: payload['severity'], type: 'incident.severity_changed' },
        };
        for (const sub of subscriptions) {
          pushAdapter.send(
            { endpoint: sub.endpoint, keys: sub.keys },
            pushPayload,
          ).catch((err: unknown) => {
            logger.error({ err, tenantId: tid, endpoint: sub.endpoint }, 'Failed to send push notification');
          });
        }
      }
    } catch (err) {
      logger.error({ err, tenantId: event.tenantId }, 'Failed to send push notifications for incident.severity_changed');
    }
  });

  eventBus.subscribe('investigation.completed', async (event) => {
    const actor = resolveInvestigationCompletedActor(event.payload);
    // Defensively extract evidences from the event payload (future-proof: producers
    // may not yet include this field; absence is safe — treated as no evidences).
    const evidences = extractEvidencesFromPayload(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'investigation.completed',
      actorType: actor.actorType,
      actorEmail: actor.actorEmail,
      resourceType: 'incident',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
      ...(evidences !== undefined && { evidences }),
    });
  });

  eventBus.subscribe('tenant.created', async (event) => {
    const actor = resolveTenantActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'tenant.created',
      actorType: actor.actorType,
      ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
      actorEmail: actor.actorEmail,
      resourceType: 'tenant',
      resourceId: event.tenantId,
      changes: event.payload,
    });
  });

  eventBus.subscribe('tenant.updated', async (event) => {
    const actor = resolveTenantActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'tenant.updated',
      actorType: actor.actorType,
      ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
      actorEmail: actor.actorEmail,
      resourceType: 'tenant',
      resourceId: event.tenantId,
      changes: event.payload,
    });
  });

  eventBus.subscribe('remediation.proposed', async (event) => {
    const actor = resolveRemediationActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'remediation.proposed',
      actorType: actor.actorType,
      ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
      actorEmail: actor.actorEmail,
      resourceType: 'remediation',
      resourceId: (event.payload['remediationId'] as string) ?? '',
      changes: event.payload,
    });
  });

  eventBus.subscribe('remediation.approved', async (event) => {
    const actor = resolveRemediationApprovedActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'remediation.approved',
      actorType: actor.actorType,
      actorEmail: actor.actorEmail,
      resourceType: 'remediation',
      resourceId: (event.payload['remediationId'] as string) ?? '',
      changes: event.payload,
    });
  });

  // Auto-execute remediation after approval
  eventBus.subscribe('remediation.approved', async (event) => {
    const rid = event.payload['remediationId'] as string;
    if (!rid) return;
    try {
      await executeRemediation.execute({
        tenantId: tenantId(event.tenantId),
        remediationId: rid as RemediationId,
      });
    } catch (err) {
      logger.error({ err, remediationId: rid }, 'Auto-execute after approval failed');
    }
  });

  eventBus.subscribe('remediation.rejected', async (event) => {
    const actor = resolveRemediationRejectedActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'remediation.rejected',
      actorType: actor.actorType,
      actorEmail: actor.actorEmail,
      resourceType: 'remediation',
      resourceId: (event.payload['remediationId'] as string) ?? '',
      changes: event.payload,
    });
  });

  eventBus.subscribe('remediation.executed', async (event) => {
    const actor = resolveRemediationActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'remediation.executed',
      actorType: actor.actorType,
      ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
      actorEmail: actor.actorEmail,
      resourceType: 'remediation',
      resourceId: (event.payload['remediationId'] as string) ?? '',
      changes: event.payload,
    });
  });


  // === EventBus Wiring: Notification SSE Broadcasts ===
  eventBus.subscribe('remediation.proposed', async (event) => {
    await sseManager.broadcast(event.tenantId, {
      event: 'remediation_proposed',
      data: event.payload,
    });
  });

  eventBus.subscribe('investigation.completed', async (event) => {
    const sseEvent = { event: 'investigation_completed', data: event.payload };
    await sseManager.broadcast(event.tenantId, sseEvent);
  });

  // === EventBus Wiring: Usage Record on Investigation Completion (AC-012) ===
  // After a successful investigation completes, persist a UsageRecordEntity
  // carrying the investigation ID, per-agent token counts and per-agent cost.
  const recordUsage = new RecordUsageUseCase(
    billingAccountRepo,
    usageRecordRepo,
    eventBus,
    stripeMeterServiceEarly,
    tenantRepo,
  );
  eventBus.subscribe('investigation.completed', async (event) => {
    const incId = (event.payload['incidentId'] as string) ?? undefined;
    const totalCostUsd =
      (event.payload['totalCostUsd'] as number | undefined) ??
      (event.payload['costUsd'] as number | undefined);
    const agentBreakdown = event.payload['agentBreakdown'] as
      | Array<{ agentRole: string; inputTokens: number; outputTokens: number; costUsd: number }>
      | undefined;
    try {
      await recordUsage.execute({
        tenantId: tenantId(event.tenantId),
        type: 'investigation',
        ...(incId && { incidentId: incidentId(incId) }),
        ...(totalCostUsd !== undefined && { costUsd: totalCostUsd }),
        ...(agentBreakdown && { agentBreakdown }),
      });
    } catch (err) {
      logger.error({ err, incidentId: incId, tenantId: event.tenantId }, 'Failed to record usage on investigation completion');
    }
  });

  eventBus.subscribe('notification.approval_responded', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'notification.approval_responded',
      actorType: 'user',
      actorEmail: (event.payload['respondedBy'] as string) ?? 'system@causeflow.ai',
      resourceType: 'approval',
      resourceId: (event.payload['approvalId'] as string) ?? '',
      changes: event.payload,
    });
  });


  // === EventBus Wiring: Investigation Progress SSE ===
  eventBus.subscribe('investigation.progress', async (event) => {
    const sseEvent = { event: 'investigation_progress', data: event.payload };
    await sseManager.broadcast(event.tenantId, sseEvent);
  });

  // === EventBus Wiring: Slack Notifications ===
  const slackNotificationSubscriber = new SlackNotificationSubscriber(
    tenantRepo,
    incidentRepo,
    slackNotificationRepo,
    logger,
    tokenEncryption,
  );
  eventBus.subscribe('incident.created', async (event) => {
    await slackNotificationSubscriber.onIncidentCreated(event);
  });
  eventBus.subscribe('investigation.completed', async (event) => {
    await slackNotificationSubscriber.onInvestigationCompleted(event);
  });
  eventBus.subscribe('investigation.progress', async (event) => {
    if (event.payload['stage'] === 'started') {
      await slackNotificationSubscriber.onInvestigationStarted(event);
    }
  });

  // === EventBus Wiring: Credential Audit Trail ===
  eventBus.subscribe('credential.vended', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'credential.vended',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'credential',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
    });
  });

  eventBus.subscribe('credential.revoked', async (event) => {
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'credential.revoked',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'credential',
      resourceId: (event.payload['incidentId'] as string) ?? '',
      changes: event.payload,
    });
  });

  // Analytics Use Cases
  const analyticsUseCases: AnalyticsUseCases = {
    getIncidentAnalytics: new GetIncidentAnalyticsUseCase(incidentRepo),
  };

  // API Key Use Cases (runtime-aware: Dynamo in AWS, Postgres in OSS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let apiKeyRepo: any;
  if (config.isOss()) {
    const { PgApiKeyRepository } = await import('./modules/tenant/infra/pg-api-key.repository.js');
    apiKeyRepo = new PgApiKeyRepository();
  } else {
    apiKeyRepo = new DynamoApiKeyRepository();
  }
  // Wire the API-key resolver into the auth middleware so `cflo_…` Bearer
  // tokens resolve to their tenant + creator identity on every request.
  configureAuthApiKeyRepo(apiKeyRepo);
  const apiKeyUseCases: ApiKeyUseCases = {
    createApiKey: new CreateApiKeyUseCase(apiKeyRepo, eventBus),
    listApiKeys: new ListApiKeysUseCase(apiKeyRepo),
    revokeApiKey: new RevokeApiKeyUseCase(apiKeyRepo, eventBus),
  };

  // === Widget Dependencies ===
  let widgetUseCases: WidgetRouteDeps | undefined;
  try {
    const sessionRepo = config.isOss()
      ? new (await import('./modules/widget/infra/pg-widget-session.repository.js')).PgWidgetSessionRepository()
      : new (await import('./modules/widget/infra/dynamo-widget-session.repository.js')).DynamoWidgetSessionRepository();

    const dataMasker = new DataMasker();
    const responseFormatter = new ResponseFormatter();
    const followUpGenerator = new FollowUpGenerator(llmClient);

    const widgetChat = new WidgetChatUseCase({
      chatUseCase: memoryUseCases.chat!,
      sessionRepo,
      llmClient,
      tenantRepo,
      dataMasker,
      responseFormatter,
      followUpGenerator,
    });

    widgetUseCases = {
      widgetChat,
      sessionRepo,
      sseManager,
      apiKeyRepo,
      tenantRepo,
      pushAdapter,
      incidentRepo,
    };

    // Register widget event subscribers (forward investigation progress to SSE)
    registerWidgetEventSubscribers({
      eventBus,
      sessionRepo,
      sseManager,
      tenantRepo,
      dataMasker,
      responseFormatter,
      pushAdapter,
    });

    logger.info('Widget routes and event subscribers registered');
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize widget dependencies — widget routes disabled');
  }

  // === EventBus Wiring: API Key Audit Trail ===
  eventBus.subscribe('apikey.created', async (event) => {
    const actor = resolveApiKeyCreatedActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'apikey.created',
      actorType: actor.actorType,
      actorEmail: actor.actorEmail,
      resourceType: 'api_key',
      resourceId: (event.payload['keyId'] as string) ?? '',
      changes: event.payload,
    });
  });

  eventBus.subscribe('apikey.revoked', async (event) => {
    const actor = resolveApiKeyRevokedActor(event.payload);
    await createAuditEntry.execute({
      tenantId: tenantId(event.tenantId),
      action: 'apikey.revoked',
      actorType: actor.actorType,
      actorEmail: actor.actorEmail,
      resourceType: 'api_key',
      resourceId: (event.payload['keyId'] as string) ?? '',
      changes: event.payload,
    });
  });

  // === Health Checker ===
  //
  // The check set is runtime-aware so that the open-source local runtime
  // (AC-039) reports exactly {postgres, redis, anthropic, queues} and never
  // pings an AWS endpoint at boot, while the original AWS control plane keeps
  // its DynamoDB / SQS checks (AC-002 / AC-005 / AC-006).
  //
  // AC-041: In the OSS runtime, the queues health check pings Redis (the
  // BullMQ transport), not SQS. The checks are unchanged from the existing
  // pattern — only the check impl differs.
  const healthChecker = new HealthChecker();
  if (config.isOss()) {
    healthChecker.register(new PostgresHealthCheck());
    healthChecker.register(new RedisHealthCheck(() => getRedisClient()));
    healthChecker.register(new AnthropicHealthCheck(anthropicCircuitBreaker));
    healthChecker.register(new QueuesHealthCheck(() => getRedisClient()));
  } else {
    healthChecker.register(new DynamoDBHealthCheck());
    healthChecker.register(new RedisHealthCheck(() => getRedisClient()));
    healthChecker.register(new SQSHealthCheck([config.sqs.alertQueueUrl, config.sqs.investigationQueueUrl, config.sqs.remediationQueueUrl]));
    healthChecker.register(new AnthropicHealthCheck(anthropicCircuitBreaker));
  }

  // === In-Process Fallback (dev without SQS) ===
  // When SQS is not configured AND we are NOT in OSS mode (which uses BullMQ),
  // wire EventBus to dispatch the pipeline in-process.
  // This ensures the full flow works in dev without docker-compose.
  // AC-041: In OSS mode, BullMQ on Redis provides the queue layer — no fallback needed.
  const sqsConfigured = !!(config.sqs.alertQueueUrl && config.sqs.investigationQueueUrl && config.sqs.remediationQueueUrl);

  if (!sqsConfigured && !config.isProd() && !config.isOss()) {
    logger.info('[STARTUP] SQS not configured — enabling in-process pipeline fallback');

    // incident.created → triage (replaces alert queue consumer)
    eventBus.subscribe('incident.created', async (event) => {
      if (!config.anthropic.apiKey) return;
      try {
        await triageIncident.execute(
          tenantId(event.tenantId),
          incidentId((event.payload['incidentId'] as string) ?? ''),
        );
      } catch (err) {
        logger.error({ err, event }, 'In-process triage failed');
      }
    });

    // incident.status_changed (to triaging) → investigation (replaces investigation queue consumer)
    eventBus.subscribe('incident.status_changed', async (event) => {
      if (!config.anthropic.apiKey) return;
      if (event.payload['to'] !== 'triaging') return;
      const iid = (event.payload['incidentId'] as string) ?? '';
      const incident = await incidentRepo.findById(tenantId(event.tenantId), incidentId(iid));
      if (!incident) return;
      const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const threshold = sevRank[config.triage.minInvestigationSeverity] ?? 1;
      if ((sevRank[incident.severity] ?? 4) > threshold) return;
      try {
        await dispatchInvestigation.execute({
          tenantId: tenantId(event.tenantId),
          incidentId: incidentId(iid),
          suggestedAgents: incident.assignedAgents ?? ['log_analyst', 'metric_analyst', 'change_detector', 'code_analyzer', 'infra_inspector', 'db_analyst'],
        });
      } catch (err) {
        logger.error({ err, event }, 'In-process investigation failed');
      }
    });

    // investigation.completed → propose remediation (manual approval)
    eventBus.subscribe('investigation.completed', async (event) => {
      const iid = (event.payload['incidentId'] as string) ?? '';
      const tid = tenantId(event.tenantId);
      const iidTyped = incidentId(iid);

      const incident = await incidentRepo.findById(tid, iidTyped);
      if (!incident) return;
      const rootCause = (event.payload['rootCause'] as string) ?? '';
      const actions = (event.payload['recommendedActions'] as StructuredAction[]) ?? [];
      if (actions.length === 0) return;
      const proposedFix = event.payload['proposedFix'] as ProposedFix | undefined;
      try {
        await proposeRemediation.execute({
          tenantId: tid,
          incidentId: iidTyped,
          rootCause,
          recommendedActions: actions,
          proposedFix,
        });
      } catch (err) {
        logger.error({ err, event }, 'In-process propose remediation failed');
      }
    });
  }

  // === EventBus Wiring: GitHub/Composio Change Events → Hindsight Memory ===
  eventBus.subscribe('graph.change_added', async (event) => {
    const tid = event.tenantId;
    const payload = event.payload;
    const changeType = (payload['changeType'] as string) ?? 'unknown';
    const description = (payload['description'] as string) ?? '';
    const source = (payload['source'] as string) ?? '';
    const metadata = (payload['metadata'] as Record<string, unknown>) ?? {};
    const serviceId = (payload['serviceId'] as string) ?? 'unknown';

    const content = `[CHANGE] ${description}. ` +
      `Service: ${serviceId}, type: ${changeType}, source: ${source}. ` +
      (metadata['branch'] ? `Branch: ${metadata['branch'] as string}. ` : '') +
      (metadata['commitSha'] ? `Commit: ${(metadata['commitSha'] as string).slice(0, 8)}. ` : '') +
      (metadata['prNumber'] ? `PR #${metadata['prNumber'] as number}. ` : '') +
      (metadata['merged'] === true ? 'Merged to production. ' : '');

    try {
      await agentMemory.retain(tid, content, {
        tags: ['change', changeType, `service:${serviceId}`, source],
        context: `change:${payload['changeId'] as string ?? event.occurredAt}`,
        metadata: {
          serviceId,
          changeType,
          ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, String(v)])),
        },
      });
      logger.info({ tenantId: tid, serviceId, changeType }, 'Change event retained in Hindsight memory');
    } catch (err) {
      logger.warn({ err, tenantId: tid }, 'Failed to retain change event in memory — non-critical');
    }
  });

  // Queue consumer startup with environment-aware validation
  const consumers: ConsumerHandle[] = [];

  function startQueueConsumer(name: string, url: string | undefined, requiresApiKey: boolean, start: (url: string) => ConsumerHandle): void {
    if (!url) {
      if (config.isProd()) {
        throw new Error(`[FATAL] ${name} queue URL required in production`);
      }
      logger.warn(`[STARTUP] ${name} consumer disabled - queue URL not configured`);
      return;
    }
    if (requiresApiKey && !config.anthropic.apiKey) {
      logger.warn(`[STARTUP] ${name} consumer disabled - ANTHROPIC_API_KEY not set`);
      return;
    }
    logger.info(`[STARTUP] ${name} consumer starting`);
    consumers.push(start(url));
  }

  if (config.isOss()) {
    // AC-041 / AC-046: Bridge investigation-worker progress (Redis) → SSE clients.
    // The worker publishes to INVESTIGATION_PROGRESS_CHANNEL; the API process
    // has no shared EventBus with the worker, so Redis is the cross-process bus.
    {
      const { subscribeProgress, INVESTIGATION_PROGRESS_CHANNEL } = await import('./shared/infra/pubsub/redis-pubsub.js');
      const eventNameMap: Record<string, string> = {
        'investigation.progress': 'investigation_progress',
        'investigation.completed': 'investigation_completed',
        'investigation.known_solution_found': 'investigation_known_solution_found',
        'investigation.inconclusive': 'investigation_inconclusive',
        'investigation.failed': 'investigation_failed',
      };
      const unsubscribe = await subscribeProgress(INVESTIGATION_PROGRESS_CHANNEL, (event) => {
        const sseEventName = eventNameMap[event.eventType] ?? event.eventType;
        const sseEvent = { event: sseEventName, data: event.payload };
        void sseManager.broadcast(event.tenantId, sseEvent);
      });
      consumers.push({ stop: unsubscribe });
    }

    // AC-041: BullMQ workers replace SQS consumers in the OSS runtime.
    // Workers process jobs from named BullMQ queues on the shared Redis instance.
    // The triage worker calls the same triageIncident use case that the SQS
    // consumer would invoke; the investigation and remediation workers are
    // started but only process when jobs arrive (no polling loop).
    const { createBullWorker } = await import('./shared/infra/queue/bull-mq-consumer.js');

    // Triage worker — picks up triage jobs from causeflow-triage
    // Workers are started unconditionally in OSS mode (no API key required).
    // If the LLM is unavailable, the fallback assigns high severity + default agents
    // so the investigation pipeline still runs (AC-046).
    {
      const triageWorker = createBullWorker({
        queueName: config.bullmq.triageQueueName,
        handler: async (body) => {
          try {
            await triageIncident.execute(
              tenantId(body['tenantId'] as string),
              incidentId(body['incidentId'] as string),
            );
          } catch (err) {
            logger.warn({ err, incidentId: body['incidentId'] }, 'Triage worker fallback — marking incident as triaged with default severity');
            const tid = tenantId(body['tenantId'] as string);
            const iid = incidentId(body['incidentId'] as string);
            try {
              await incidentRepo.update(tid, iid, {
                severity: 'high',
                status: 'triaging',
                updatedAt: new Date().toISOString(),
              });
            } catch (updateErr) {
              logger.error({ err: updateErr, incidentId: body['incidentId'] }, 'Triage worker fallback update failed');
            }
          }
        },
      });
      consumers.push({ stop: triageWorker.stop });
    }

    // Investigation worker — NOT started in the API (AC-045).
    // The `causeflow-worker` docker-compose service runs a long-lived BullMQ
    // consumer that picks up investigation jobs from causeflow-investigation.
    // Running a second consumer in the API would cause double processing.

    // Remediation worker — picks up remediation jobs from causeflow-remediation
    const remediationWorker = createBullWorker({
      queueName: config.bullmq.remediationQueueName,
      handler: async (body) => {
        await proposeRemediation.execute({
          tenantId: tenantId(body['tenantId'] as string),
          incidentId: incidentId(body['incidentId'] as string),
          rootCause: (body['rootCause'] as string) ?? '',
          recommendedActions: (body['recommendedActions'] as StructuredAction[]) ?? [],
        });
      },
    });
    consumers.push({ stop: remediationWorker.stop });
  } else {
    // AWS runtime: SQS consumers
    startQueueConsumer('triage', alertQueueUrl, true, (url) => {
      return startTriageConsumer(url, triageIncident);
    });

    startQueueConsumer('investigation', investigationQueueUrl, true, (url) => {
      return startInvestigationConsumer(url);
    });

    startQueueConsumer('remediation', remediationQueueUrl, false, (url) => {
      return startRemediationConsumer(url, proposeRemediation);
    });

    startQueueConsumer('progress', config.sqs.progressQueueUrl, false, (url) => {
      return startProgressConsumer(url, sseManager);
    });
  }

  // Register Composio webhook subscription if apiKey is configured
  if (config.composio.apiKey) {
    const webhookUrl = config.composio.webhookUrl ||
      `${process.env['APP_BASE_URL'] ?? 'https://api.causeflow.io'}/webhooks/composio`;
    composioTriggerService.registerWebhookSubscription(webhookUrl)
      .then(({ registered, url }) => {
        if (registered) {
          logger.info({ url }, 'composio.webhook.registered');
        } else {
          logger.info({ url }, 'composio.webhook.already_registered');
        }
      })
      .catch((err) => {
        logger.warn({ err: err instanceof Error ? err.message : err }, 'composio.webhook.registration_failed');
      });
  }

  // OSS auth router (register + login) — defined only in OSS runtime
  if (config.isOss()) {
    const { createOssAuthRoutes } = await import('./modules/auth/infra/oss-auth.routes.js');
    ossAuthRouter = createOssAuthRoutes({ tenantRepo, userRepo });
  }

  // Skills routes (per-tenant investigation skills) — AC-027
  const createSkill = new CreateSkillUseCase(skillRepo);
  const listSkills = new ListSkillsUseCase(skillRepo);
  const getSkill = new GetSkillUseCase(skillRepo);
  const updateSkill = new UpdateSkillUseCase(skillRepo);
  const deleteSkill = new DeleteSkillUseCase(skillRepo);
  const skillRoutes = createSkillRoutes({
    createSkill,
    listSkills,
    getSkill,
    updateSkill,
    deleteSkill,
  });

  return {
    eventBus,
    providerRegistry,
    tenantUseCases,
    auditUseCases,
    createAuditEntry,
    webhookUseCases,
    incidentUseCases,
    triageUseCases,
    investigationUseCases,
    remediationUseCases,
    notificationUseCases,
    analyticsUseCases,
    adminDeps: { incidentRepo, ingestAlert: webhookUseCases.ingestAlert, createManualIncident },
    apiKeyUseCases,
    codeKnowledgeUseCases,
    relayGateway: overrides?.relayGateway,
    sseManager,
    healthChecker,
    consumers,
    corsOrigins: config.cors.allowedOrigins,
    billingUseCases,
    integrationUseCases,
    triggerUseCases,
    composioWebhookDeps,
    authUseCases,
    userUseCases,
    memoryUseCases,
    skillRoutes,
    widgetUseCases,
    ossAuthRouter,
  };
}
