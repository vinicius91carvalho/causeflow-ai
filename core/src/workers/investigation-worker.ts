import { HindsightAgentMemory } from '../shared/infra/memory/hindsight-agent-memory.js';
import { config } from '../shared/config/index.js';
import { logger } from '../shared/infra/logger.js';
import { EventBus } from '../shared/domain/events.js';
// Repository imports are selected at runtime based on CAUSEFLOW_RUNTIME.
// In OSS mode (BullMQ consumer), Postgres repos are used. In one-shot mode
// (AWS ECS tasks), DynamoDB repos are used.
import type { IIncidentRepository } from '../modules/ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../modules/triage/domain/evidence.repository.js';
import type { IToolCallRepository } from '../modules/triage/domain/tool-call.repository.js';
import type { ITenantRepository } from '../modules/tenant/domain/tenant.repository.js';
import type { IBillingAccountRepository } from '../modules/billing/domain/billing-account.repository.js';
import { RefundInvestigationUseCase } from '../modules/billing/application/refund-investigation.usecase.js';
import { ProviderRegistry } from '../shared/application/provider-registry.js';
import { StubCloudProvider } from '../shared/infra/cloud/stub-cloud-provider.js';
import { StubCredentialVendor } from '../shared/infra/credentials/stub-credential-vendor.js';
import { AnthropicClient } from '../shared/infra/llm/anthropic-client.js';
import { EnhancedPTCRunner } from '../shared/infra/llm/enhanced-ptc-runner.js';
import type { ISkillRepository } from '../modules/skills/domain/skill.repository.js';
import { SelectSkillsUseCase } from '../modules/skills/application/select-skills.usecase.js';
import { createObservabilityStack } from '../shared/infra/observability/observability-factory.js';
import { ObservedAnthropicClient } from '../shared/infra/llm/observed-anthropic-client.js';
import { ObservedAgentRunner } from '../shared/infra/llm/observed-agent-runner.js';
import { CircuitBreaker } from '../shared/infra/llm/circuit-breaker.js';
import type { MessageQueue } from '../shared/application/ports/message-queue.port.js';
import { ComposioToolProvider } from '../shared/infra/integrations/composio-tool-provider.js';
import { InvestigateIncidentUseCase } from '../modules/investigation/application/investigate-incident.usecase.js';
import { DispatchInvestigationUseCase } from '../modules/investigation/application/dispatch-investigation.usecase.js';
import { OrchestratorMode } from '../modules/investigation/application/modes/orchestrator-mode.js';
import { HypothesisMode } from '../modules/investigation/application/modes/hypothesis/index.js';
import { DebateMode } from '../modules/investigation/application/modes/debate/index.js';
import { OrchestratorToolsetAdapter } from '../modules/investigation/application/modes/shared/orchestrator-toolset.adapter.js';
import { InvestigationModeRegistry } from '../modules/investigation/application/modes/registry.js';
import type { IHypothesisRepository } from '../modules/investigation/domain/hypothesis.repository.js';
import { GetCloudIntegrationUseCase } from '../modules/integration/application/get-cloud-integration.usecase.js';
import { AesGcmTokenEncryption } from '../shared/infra/credentials/aes-gcm-token-encryption.js';
import { createToolHandler, incidentDetailsTool } from '../modules/investigation/infra/investigation-tools.js';
import { MEMORY_TOOLS } from '../modules/investigation/infra/memory-tools.js';
import { CHECKPOINT_TOOLS } from '../modules/investigation/infra/checkpoint-tools.js';
import { tenantId, incidentId } from '../shared/domain/value-objects.js';
import type { LLMClient } from '../shared/application/ports/llm-client.port.js';
import type { IntegrationToolProvider } from '../shared/application/ports/integration-tool-provider.port.js';
import type { ToolDefinition } from '../shared/application/ports/agent-runner.port.js';
import type { CloudCredentials } from '../shared/application/ports/cloud-provider.port.js';
import { publishProgressToSQS } from '../shared/infra/pubsub/sqs-progress.js';
import { publishProgress, INVESTIGATION_PROGRESS_CHANNEL } from '../shared/infra/pubsub/redis-pubsub.js';
import { InvestigationWSClient } from '../shared/infra/relay/investigation-ws-client.js';

const DEFAULT_SUGGESTED_AGENTS = [
    'log_analyst',
    'metric_analyst',
    'change_detector',
    'code_analyzer',
    'infra_inspector',
    'db_analyst',
];

/** Forward progress to SQS (AWS) and Redis pub/sub (OSS local runtime). */
async function forwardProgress(eventType: string, tenantId: string, payload: Record<string, unknown>): Promise<void> {
    await publishProgressToSQS(config.sqs.progressQueueUrl, { eventType, tenantId, payload });
    if (config.isOss()) {
        await publishProgress(INVESTIGATION_PROGRESS_CHANNEL, { eventType, tenantId, payload });
    }
}
// ── Read environment ────────────────────────────────────────────────
const INCIDENT_ID = process.env['INCIDENT_ID'];
const TENANT_ID = process.env['TENANT_ID'];
const SUGGESTED_AGENTS = (process.env['SUGGESTED_AGENTS'] ?? '').split(',').filter(Boolean);
const OSS_RUNTIME = process.env['CAUSEFLOW_RUNTIME'] === 'oss';

// AC-045: In the open-source local runtime the `causeflow-worker` compose service
// is a LONG-LIVED BullMQ consumer that processes investigation jobs from the
// `causeflow-investigation` queue. When started with no INCIDENT_ID and
// CAUSEFLOW_RUNTIME=oss it enters BullMQ consumer mode and runs investigations
// as jobs arrive. The per-incident dispatch path (INCIDENT_ID set — one-shot
// mode for AWS ECS tasks) is unchanged.
const BULLMQ_CONSUMER_MODE = OSS_RUNTIME && !INCIDENT_ID;

if (!BULLMQ_CONSUMER_MODE && (!INCIDENT_ID || !TENANT_ID)) {
    logger.fatal({ INCIDENT_ID, TENANT_ID }, 'Missing required env vars INCIDENT_ID / TENANT_ID');
    process.exit(1);
}
// ── Constants ──────────────────────────────────────────────────────
const INVESTIGATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes post-investigation (was 30 — relay shuts us down earlier when dashboards leave)
/** Grace period after a server-issued shutdown before we actually exit. */
const SHUTDOWN_GRACE_MS = 5_000;
const WORKER_MODE = process.env['WORKER_MODE'] ?? 'investigate'; // 'investigate' | 'followup'
// ── Worker Bootstrap ────────────────────────────────────────────────
// Creates ONLY the deps needed for investigation — no HTTP server, no
// SQS consumers, no SSE, no scheduled jobs.
async function workerBootstrap(ossMode?: boolean) {
    // AC-045: In OSS mode (BullMQ consumer), use Postgres repos + BullMQ.
    // In one-shot mode (AWS ECS tasks), use DynamoDB repos + SQS.
    const useOssRepos = ossMode ?? false;
    const eventBus = new EventBus();
    eventBus.setErrorLogger((eventType, err) => {
        logger.error({ err, eventType }, 'EventBus handler error');
    });
    // Forward EventBus progress/completion events to SQS (AWS) and Redis (OSS)
    eventBus.subscribe('investigation.progress', async (event) => {
        await forwardProgress('investigation.progress', event.tenantId, event.payload);
    });
    eventBus.subscribe('investigation.completed', async (event) => {
        await forwardProgress('investigation.completed', event.tenantId, event.payload);
    });
    eventBus.subscribe('investigation.known_solution_found', async (event) => {
        await forwardProgress('investigation.known_solution_found', event.tenantId, event.payload);
    });
    // Inconclusive investigations are a terminal state — forward the event to
    // the progress channel so the dashboard can display the inconclusive UI, then
    // the worker exits immediately (no idle mode needed for inconclusive results).
    eventBus.subscribe('investigation.inconclusive', async (event) => {
        await forwardProgress('investigation.inconclusive', event.tenantId, event.payload);
    });
    const providerRegistry = new ProviderRegistry();

    // AC-045: OSS-aware repository + message queue selection
    let incidentRepo: IIncidentRepository;
    let evidenceRepo: IEvidenceRepository;
    let toolCallRepo: IToolCallRepository;
    let tenantRepo: ITenantRepository;
    let billingAccountRepo: IBillingAccountRepository;
    let skillRepo: ISkillRepository;
    let hypothesisRepo: IHypothesisRepository;
    let messageQueue: MessageQueue;

    if (useOssRepos) {
        const { PgIncidentRepository } = await import('../modules/ingestion/infra/pg-incident.repository.js');
        const { PgEvidenceRepository } = await import('../modules/triage/infra/pg-evidence.repository.js');
        const { PgToolCallRepository } = await import('../modules/triage/infra/pg-tool-call.repository.js');
        const { PgTenantRepository } = await import('../modules/tenant/infra/pg-tenant.repository.js');
        const { PgBillingAccountRepository } = await import('../modules/billing/infra/pg-billing-account.repository.js');
        const { PgSkillRepository } = await import('../modules/skills/infra/pg-skill.repository.js');
        const { PgHypothesisRepository } = await import('../modules/investigation/infra/pg-hypothesis.repository.js');
        const { BullMqMessageQueue } = await import('../shared/infra/queue/bull-mq-message-queue.js');
        incidentRepo = new PgIncidentRepository();
        evidenceRepo = new PgEvidenceRepository();
        toolCallRepo = new PgToolCallRepository();
        tenantRepo = new PgTenantRepository();
        billingAccountRepo = new PgBillingAccountRepository();
        skillRepo = new PgSkillRepository();
        hypothesisRepo = new PgHypothesisRepository();
        messageQueue = new BullMqMessageQueue();
    } else {
        const { DynamoIncidentRepository } = await import('../modules/ingestion/infra/dynamo-incident.repository.js');
        const { DynamoEvidenceRepository } = await import('../modules/triage/infra/dynamo-evidence.repository.js');
        const { DynamoToolCallRepository } = await import('../modules/triage/infra/dynamo-tool-call.repository.js');
        const { DynamoTenantRepository } = await import('../modules/tenant/infra/dynamo-tenant.repository.js');
        const { DynamoBillingAccountRepository } = await import('../modules/billing/infra/dynamo-billing-account.repository.js');
        const { DynamoSkillRepository } = await import('../modules/skills/infra/dynamo-skill.repository.js');
        const { DynamoHypothesisRepository } = await import('../modules/investigation/infra/dynamo-hypothesis.repository.js');
        const { SQSMessageQueue } = await import('../shared/infra/queue/sqs-message-queue.js');
        incidentRepo = new DynamoIncidentRepository();
        evidenceRepo = new DynamoEvidenceRepository();
        toolCallRepo = new DynamoToolCallRepository();
        tenantRepo = new DynamoTenantRepository();
        billingAccountRepo = new DynamoBillingAccountRepository();
        skillRepo = new DynamoSkillRepository();
        hypothesisRepo = new DynamoHypothesisRepository();
        messageQueue = new SQSMessageQueue();
    }
    // Observability
    const { tracer, metrics } = await createObservabilityStack();
    // Circuit Breaker
    const anthropicCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60_000 }, (from, to) => {
        if (to === 'open') {
            eventBus.publish({ eventType: 'ai.unavailable', occurredAt: new Date().toISOString(), tenantId: 'system', payload: { from, to } }).catch(() => { });
        }
    });
    // LLM Client + Agent Runner (with investigation context for Langfuse sessions/users)
    const traceContext = { sessionId: INCIDENT_ID!, userId: TENANT_ID! };
    const rawLlmClient = (() => {
        const client = new AnthropicClient();
        client.setCircuitBreaker(anthropicCircuitBreaker);
        return client;
    })();
    const rawAgentRunner = config.enhancedRunner.mastra
        ? new (await import('../shared/infra/llm/mastra-agent-runner.js')).MastraAgentRunner()
        : new EnhancedPTCRunner();
    const llmClient = new ObservedAnthropicClient(rawLlmClient, tracer, metrics, traceContext);
    const agentRunner = new ObservedAgentRunner(rawAgentRunner, tracer, metrics, traceContext);
    // Cloud Provider
    const cloudProvider = config.isProd() || config.sts.roleArn
        ? new (await import('../shared/infra/cloud/aws-cloud-provider.js')).AWSCloudProvider()
        : new StubCloudProvider();
    providerRegistry.registerCloudProvider('aws', cloudProvider);
    // Credential Vendor
    const tokenEncryption = new AesGcmTokenEncryption();
    const getCloudIntegration = new GetCloudIntegrationUseCase(tokenEncryption);
    const credentialVendor = config.isDev() || config.isTest()
        ? new StubCredentialVendor()
        : new (await import('../shared/infra/credentials/sts-credential-vendor.js')).STSCredentialVendor(undefined, tenantRepo, getCloudIntegration);
    providerRegistry.registerCredentialVendor(credentialVendor);
    // Composio (conditional)
    const integrationToolProvider = config.composio.apiKey
        ? new ComposioToolProvider()
        : undefined;
    // Skills
    // skillRepo is already set in the OSS-aware block above
    const selectSkills = new SelectSkillsUseCase(skillRepo, llmClient as unknown as LLMClient);
    // Investigation Use Case
    const investigateIncident = new InvestigateIncidentUseCase({
        incidentRepo: incidentRepo as unknown as IIncidentRepository,
        evidenceRepo,
        toolCallRepo,
        eventBus,
        agentRunner,
        llmClient: llmClient as unknown as LLMClient,
        cloudProvider,
        credentialVendor,
        toolHandlerFactory: createToolHandler,
        messageQueue,
        remediationQueueUrl: useOssRepos ? config.bullmq.remediationQueueName : config.sqs.remediationQueueUrl,
        defaultRegion: config.aws.region,
        synthesisModel: config.anthropic.synthesisModel,
        integrationToolProvider: integrationToolProvider as IntegrationToolProvider | undefined,
        agentMemory: new HindsightAgentMemory({ baseUrl: config.hindsight.baseUrl, apiKey: config.hindsight.apiKey }),
        selectSkills,
        hypothesisRepo,
    });
    // Billing — refund on failure
    // billingAccountRepo is already set in the OSS-aware block above
    const refundInvestigation = new RefundInvestigationUseCase(billingAccountRepo);

    const agentMemory = new HindsightAgentMemory({ baseUrl: config.hindsight.baseUrl, apiKey: config.hindsight.apiKey });
    // Investigation mode dispatcher — orchestrator is default, hypothesis mode
    // is available for staff to toggle per-incident via the admin endpoint.
    // hypothesisRepo is already set in the OSS-aware block above
    const toolsetAdapter = new OrchestratorToolsetAdapter(investigateIncident);
    const hypothesisMode = new HypothesisMode({
        toolset: toolsetAdapter,
        hypothesisRepo,
        incidentRepo: incidentRepo as unknown as IIncidentRepository,
        evidenceRepo,
        eventBus,
        agentRunner,
        llmClient: llmClient as unknown as LLMClient,
        cloudProvider,
        credentialVendor,
        toolHandlerFactory: createToolHandler,
        integrationToolProvider: integrationToolProvider as IntegrationToolProvider | undefined,
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
        incidentRepo: incidentRepo as unknown as IIncidentRepository,
        evidenceRepo,
        eventBus,
        agentRunner,
        llmClient: llmClient as unknown as LLMClient,
        cloudProvider,
        credentialVendor,
        toolHandlerFactory: createToolHandler,
        integrationToolProvider: integrationToolProvider as IntegrationToolProvider | undefined,
        agentMemory,
        seekerModel: config.anthropic.seekerModel,
        seekerColdStartModel: config.anthropic.seekerColdStartModel,
        advocateModel: config.anthropic.agentModels.orchestrator,
        prosecutorModel: config.anthropic.agentModels.orchestrator,
        judgeModel: config.anthropic.synthesisModel,
        metrics,
    });
    const modeRegistry = new InvestigationModeRegistry([
        new OrchestratorMode(investigateIncident),
        hypothesisMode,
        debateMode,
    ]);
    const dispatchInvestigation = new DispatchInvestigationUseCase({
        incidentRepo: incidentRepo as unknown as IIncidentRepository,
        registry: modeRegistry,
        metrics,
    });
    return {
        investigateIncident: dispatchInvestigation,
        incidentRepo,
        refundInvestigation,
        // Exposed for the follow-up agent path below so Q&A has the same tools as investigation.
        integrationToolProvider,
        credentialVendor,
        cloudProvider,
        agentMemory,
    };
}
// ── Main ────────────────────────────────────────────────────────────
async function main() {
    logger.info({ incidentId: INCIDENT_ID, tenantId: TENANT_ID, suggestedAgents: SUGGESTED_AGENTS, mode: WORKER_MODE }, 'Investigation worker starting');
    const { investigateIncident, incidentRepo, refundInvestigation, integrationToolProvider, credentialVendor, cloudProvider, agentMemory } = await workerBootstrap(false);
    const tid = tenantId(TENANT_ID!);
    const iid = incidentId(INCIDENT_ID!);

    // Connect to investigation relay (optional — investigation works without it)
    let investigationChannel: InvestigationWSClient | undefined;
    const relayUrl = process.env['INVESTIGATION_RELAY_URL'];
    const relayToken = process.env['INVESTIGATION_RELAY_TOKEN'];
    if (relayUrl && relayToken) {
        investigationChannel = new InvestigationWSClient({
            relayUrl,
            token: relayToken,
            tenantId: TENANT_ID!,
            incidentId: INCIDENT_ID!,
        });
        await investigationChannel.connect();
        investigationChannel.sendProgress({ stage: 'provisioning', message: 'Worker connected — starting investigation...' });
    }
    // Watchdog timer — kill the worker if investigation takes too long
    const handleTimeout = () => {
        logger.error({ incidentId: INCIDENT_ID, tenantId: TENANT_ID }, 'Investigation timed out after 5 minutes');
        incidentRepo.updateStatus(tid, iid, 'failed')
            .then(() => refundInvestigation.execute(tid))
            .then(() => forwardProgress('investigation.failed', TENANT_ID!, {
                incidentId: INCIDENT_ID!, reason: 'timeout',
            }))
            .catch((err: unknown) => {
                logger.error({ err }, 'Failed to update status on timeout');
            })
            .finally(() => { process.exit(1); });
    };
    const watchdog = setTimeout(handleTimeout, INVESTIGATION_TIMEOUT_MS);
    try {
        // Build Mastra Memory config for conversation persistence
        const memoryConfig = config.enhancedRunner.mastra ? {
            thread: { id: `investigation-${INCIDENT_ID}`, metadata: { incidentId: INCIDENT_ID, type: 'investigation' } },
            resource: TENANT_ID!,
        } : undefined;

        if (WORKER_MODE === 'followup') {
            // Followup mode: skip investigation, go straight to idle for Q&A
            clearTimeout(watchdog);
            logger.info({ incidentId: INCIDENT_ID, tenantId: TENANT_ID }, 'Followup worker — skipping investigation, entering idle mode');
            if (!investigationChannel?.isConnected()) {
                logger.info({ incidentId: INCIDENT_ID }, 'Followup worker has no relay — exiting');
                process.exit(0);
            }
        } else {
            // Normal investigation mode
            await investigateIncident.execute({
                tenantId: tid,
                incidentId: iid,
                suggestedAgents: SUGGESTED_AGENTS.length > 0
                    ? SUGGESTED_AGENTS
                    : ['log_analyst', 'metric_analyst', 'change_detector', 'code_analyzer', 'infra_inspector', 'db_analyst'],
                channel: investigationChannel,
                memory: memoryConfig,
            });
            clearTimeout(watchdog);

            // Inconclusive investigations are a terminal state — the use case already
            // persisted the status and published investigation.inconclusive to SQS.
            // Do not enter idle mode; exit cleanly so Fargate doesn't bill for idle time.
            const completedIncident = await incidentRepo.findById(tid, iid);
            if (completedIncident?.status === 'inconclusive') {
                investigationChannel?.complete();
                logger.info({ incidentId: INCIDENT_ID, tenantId: TENANT_ID }, 'Investigation inconclusive — worker exiting');
                process.exit(0);
            }

            // If no relay connected, exit immediately (no one to talk to)
            if (!investigationChannel?.isConnected()) {
                investigationChannel?.complete();
                logger.info({ incidentId: INCIDENT_ID, tenantId: TENANT_ID }, 'Investigation worker complete (no relay)');
                process.exit(0);
            }
        }

        // --- Idle Mode: stay alive for follow-up questions ---
        logger.info({ incidentId: INCIDENT_ID, tenantId: TENANT_ID, idleMinutes: Math.round(IDLE_TIMEOUT_MS / 60000) }, 'Investigation complete — entering idle mode');

        // Read incident for follow-up context
        const incident = await incidentRepo.findById(tid, iid);

        // Signal completion with structured data (single source of truth — no rootCause in idle)
        const activeChannel = investigationChannel;
        activeChannel.sendComplete({
            rootCause: incident?.rootCause ?? undefined,
            severity: incident?.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
            recommendedActions: incident?.recommendedActions?.map((a: { action: string; label?: string; description?: string; riskLevel?: string }) => ({
                action: a.action,
                label: a.label,
                description: a.description,
                riskLevel: a.riskLevel,
            })),
            status: incident?.status,
            durationMs: incident?.investigationDurationMs,
            // costUsd and agentsUsed are internal — never sent to the client
        });

        // Signal idle availability — context is structured JSON, NOT a rootCause repeat
        const idleExpiry = new Date(Date.now() + IDLE_TIMEOUT_MS);
        const idleContext = incident ? {
            title: incident.title,
            description: incident.description,
            rootCause: incident.rootCause ?? undefined,
            status: incident.status,
            severity: incident.severity,
        } : undefined;
        activeChannel.sendIdle(
            `Investigation complete. Worker available for follow-up questions.`,
            idleExpiry,
            idleContext,
        );

        // Build follow-up context string for the LLM (internal only, not sent via WS)
        const investigationContext = incident
            ? `Incident: ${incident.title}\nDescription: ${incident.description}\nRoot Cause: ${incident.rootCause ?? 'Unknown'}\nStatus: ${incident.status}`
            : `Incident ${INCIDENT_ID} investigation completed.`;

        // Set up follow-up agent runner for Q&A
        const followupRunner = config.enhancedRunner.mastra
            ? new (await import('../shared/infra/llm/mastra-agent-runner.js')).MastraAgentRunner()
            : new EnhancedPTCRunner();
        const conversationHistory: Array<{ role: 'operator' | 'agent'; message: string; timestamp: string }> = [];

        // Build the same tool inventory the orchestrator had so follow-up Q&A can actually
        // check Composio (Notion/Shortcut/GitHub), AWS, and memory — not just parrot the report.
        const followupTools: ToolDefinition[] = [incidentDetailsTool, ...MEMORY_TOOLS, ...CHECKPOINT_TOOLS];
        let followupCredentials: CloudCredentials | undefined;
        let connectedComposioApps: string[] = [];
        try {
            if (credentialVendor) {
                const vended = await credentialVendor.vend({
                    tenantId: tid, incidentId: iid, agentRole: 'orchestrator',
                    provider: cloudProvider.name, requestedPermissions: [],
                });
                if (vended.provider !== 'stub' && vended.credentials['accessKeyId']) {
                    followupCredentials = vended;
                    const { AWS_API_CALL_TOOL: loadedAwsApiTool } = await import('../modules/investigation/infra/aws-api-tool.js');
                    followupTools.push(loadedAwsApiTool);
                }
            }
        } catch (err) {
            logger.warn({ err, incidentId: INCIDENT_ID }, 'Follow-up: failed to vend AWS credentials — continuing without AWS tools');
        }
        try {
            if (integrationToolProvider) {
                const conns = await integrationToolProvider.getConnectionStatus(TENANT_ID!);
                connectedComposioApps = conns
                    .filter((c: { status: string; provider: string }) => c.status === 'connected')
                    .map((c: { status: string; provider: string }) => c.provider);
                if (connectedComposioApps.length > 0) {
                    const composioTools = await integrationToolProvider.getTools(TENANT_ID!, connectedComposioApps);
                    followupTools.push(...composioTools);
                    logger.info({ incidentId: INCIDENT_ID, composioToolCount: composioTools.length, connectedComposioApps }, 'Follow-up: Composio tools loaded');
                }
            }
        } catch (err) {
            logger.warn({ err, incidentId: INCIDENT_ID }, 'Follow-up: failed to load Composio tools');
        }
        const baseFollowupHandler = createToolHandler({
            cloudCredentials: followupCredentials ?? { provider: 'stub', credentials: {}, region: config.aws.region },
            incidentRepo: incidentRepo as unknown as IIncidentRepository,
            tenantId: tid,
            incidentId: iid,
            agentMemory,
            integrationToolProvider: integrationToolProvider as IntegrationToolProvider | undefined,
        });
        // Checkpoint tools (report_finding / request_confirmation / request_context). The
        // full investigation handler wires these to the channel's onGuidance for blocking
        // user round-trips; the follow-up runs inside an already-interactive chat loop and
        // uses maxTurns: 5, so we give the tools a non-blocking handler: report_finding
        // still broadcasts to the dashboard as a checkpoint, and the other two degrade
        // gracefully instead of stealing our guidance listener.
        // Narrow `unknown` inputs to string so we can template them without
        // the no-base-to-string lint tripping on [object Object] coercions.
        const asString = (value: unknown, fallback = ''): string =>
            typeof value === 'string' ? value : fallback;

        const followupToolHandler = async (name: string, input: Record<string, unknown>): Promise<string> => {
            if (name === 'report_finding') {
                const finding = asString(input['finding']);
                const severity = (asString(input['severity'], 'info') as 'info' | 'warning' | 'critical');
                const category = asString(input['category'], 'followup');
                logger.info({ incidentId: INCIDENT_ID, finding: finding.slice(0, 100), severity, category }, 'Follow-up: agent reported finding');
                if (activeChannel.isConnected()) {
                    activeChannel.sendCheckpoint({ stage: 'followup_finding', finding, severity, category });
                }
                return `Finding surfaced to operator: "${finding}" [${severity}/${category}].`;
            }
            if (name === 'request_confirmation') {
                const question = asString(input['question']);
                const defaultAction = asString(input['defaultAction'], 'proceed');
                logger.info({ incidentId: INCIDENT_ID, question: question.slice(0, 100) }, 'Follow-up: request_confirmation (auto-default in Q&A)');
                return `You are in a follow-up Q&A — ask the operator directly in your next message instead of blocking. For now, proceed with default: ${defaultAction}.`;
            }
            if (name === 'request_context') {
                const question = asString(input['question']);
                logger.info({ incidentId: INCIDENT_ID, question: question.slice(0, 100) }, 'Follow-up: request_context (auto-default in Q&A)');
                return `You are in a follow-up Q&A — the operator is already on the other side of this chat. Phrase "${question}" as a direct question in your reply instead of calling request_context.`;
            }
            return baseFollowupHandler(name, input);
        };

        // Listen for follow-up questions
        let idleTimer = setTimeout(() => {
            logger.info({ incidentId: INCIDENT_ID }, 'Idle timeout reached — shutting down');
            activeChannel.close();
            process.exit(0);
        }, IDLE_TIMEOUT_MS);

        // Server can ask us to shut down when the last dashboard observer drops —
        // avoids paying for Fargate idle time nobody is watching.
        activeChannel.onShutdown?.((reason?: string) => {
            logger.info({ incidentId: INCIDENT_ID, reason }, 'Received shutdown signal from relay — exiting after grace');
            clearTimeout(idleTimer);
            setTimeout(() => {
                activeChannel.close();
                process.exit(0);
            }, SHUTDOWN_GRACE_MS);
        });

        activeChannel.onGuidance((guidance: string) => {
            // Reset idle timer on each interaction
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                logger.info({ incidentId: INCIDENT_ID }, 'Idle timeout reached — shutting down');
                activeChannel.close();
                process.exit(0);
            }, IDLE_TIMEOUT_MS);

            logger.info({ incidentId: INCIDENT_ID, guidance: guidance.slice(0, 100) }, 'Follow-up question received');
            conversationHistory.push({ role: 'operator', message: guidance, timestamp: new Date().toISOString() });

            void (async () => {
                try {
                    // Reserved for when we wire follow-up prompts to the
                    // conversation history — leave it prefixed so lint
                    // tolerates the unused binding in the meantime.
                    const _historyContext = conversationHistory.length > 1
                        ? `\n\n## Conversation History\n${conversationHistory.slice(-10).map((m: { role: string; message: string }) => `[${m.role}] ${m.message}`).join('\n')}`
                        : '';
                    void _historyContext;

                    const connectedLine = connectedComposioApps.length > 0
                        ? `Connected integrations: ${connectedComposioApps.join(', ')}${followupCredentials ? ', AWS' : ''}`
                        : followupCredentials ? 'Connected integrations: AWS' : 'Connected integrations: none';
                    const result = await followupRunner.run({
                        model: config.anthropic.agentModels.followup,
                        maxTurns: 5,
                        staticSystemPrompt: `You are a senior SRE continuing an investigation that has already produced a root cause report. The operator is now talking to you directly — treat every message as live input to the investigation, not as a post-mortem interview.

## Investigation Snapshot
${investigationContext}

## What the operator may be doing
Read each message in context and respond accordingly:

- **Asking a pointed question** ("qual é o link da story 51?", "em qual região está esse bucket?") — answer directly and briefly. Use a tool if you need a real value you don't have; don't run a full methodology.
- **Pointing out an error** ("você olhou errado", "não é isso", "ignorou o DynamoDB") — take it seriously. Go back to the tools, verify the claim, check the counter-evidence. Update your conclusion if the operator is right. Say so clearly if the operator is mistaken and show evidence.
- **Pivoting the focus** ("olha o serviço X em vez de Y", "confere o deploy de ontem") — switch context immediately and investigate the new lead with tools.
- **Adding information** ("deployamos às 14h", "este serviço processa webhooks") — acknowledge, integrate into your reasoning, surface any consequences.

## Rules of engagement
- This is a conversation, not a report. Do not end replies with the structured "## Root Cause / ## Timeline / ## Evidence" format — that already shipped.
- Use tools proactively when the operator's input could be verified or refuted. ${connectedLine}.
- Keep responses short when the operator asks something short. Go deeper only when the operator is challenging a conclusion or pivoting the investigation.
- Cite specific data when you disagree with the operator ("I see 3 DynamoDB tables in us-east-2, none with the name you mentioned — here they are: ...").
- Never fabricate. If tools fail or a value isn't available, say so plainly and propose what the operator could check.
- Portuguese or English — match the operator's language.`,
                        systemPrompt: '',
                        userPrompt: guidance,
                        tools: followupTools,
                        toolHandler: followupToolHandler,
                    });

                    conversationHistory.push({ role: 'agent', message: result.response, timestamp: new Date().toISOString() });
                    activeChannel.sendFollowup(result.response);
                } catch (err) {
                    logger.error({ err, incidentId: INCIDENT_ID }, 'Follow-up agent failed');
                    activeChannel.sendFollowup('Sorry, I encountered an error processing your question. Please try again.');
                }
            })();
        });

        // Keep process alive — the event loop stays open due to WS connection + timer
    }
    catch (err) {
        clearTimeout(watchdog);
        logger.fatal({ err, incidentId: INCIDENT_ID, tenantId: TENANT_ID }, 'Investigation worker failed');
        // Notify dashboard of failure before closing relay
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        if (investigationChannel?.isConnected()) {
            investigationChannel.error(`Investigation failed: ${errorMsg}`);
        }
        // Mark incident as failed so it doesn't stay stuck as 'investigating'
        try {
            await incidentRepo.updateStatus(tid, iid, 'failed');
            // Refund the reserved investigation credit since it failed
            await refundInvestigation.execute(tid);
            await forwardProgress('investigation.failed', TENANT_ID!, {
                incidentId: INCIDENT_ID!,
                reason: errorMsg,
            });
        }
        catch (statusErr) {
            logger.error({ err: statusErr }, 'Failed to update incident status to failed');
        }
        process.exit(1);
    }
}
// AC-045: BullMQ consumer mode for the long-lived OSS worker container.
// When CAUSEFLOW_RUNTIME=oss and INCIDENT_ID is NOT set, run a BullMQ
// consumer that listens for investigation jobs from the investigation queue.
// This replaces the previous standby mode.
async function startBullConsumer(): Promise<void> {
    const { createBullWorker } = await import('../shared/infra/queue/bull-mq-consumer.js');
    const investigate = await workerBootstrap(true);
    logger.info(
        { queueName: config.bullmq.investigationQueueName, mode: 'bullmq-consumer' },
        'causeflow-worker BullMQ consumer starting — waiting for investigation jobs',
    );

    const consumer = createBullWorker({
        queueName: config.bullmq.investigationQueueName,
        handler: async (body) => {
            const tid = body['tenantId'] as string;
            const iid = body['incidentId'] as string;
            const rawAgents = body['suggestedAgents'] as string[] | undefined;
            const suggestedAgents = (rawAgents && rawAgents.length > 0)
                ? rawAgents
                : DEFAULT_SUGGESTED_AGENTS;

            if (!tid || !iid) {
                logger.warn({ body }, 'BullMQ investigation job missing tenantId or incidentId — skipping');
                return;
            }

            // AC-045: This log line is the verification signal — the AC test
            // tails worker container logs and confirms `investigation:start`.
            logger.info({ incidentId: iid, tenantId: tid, suggestedAgents }, 'investigation:start');
            await investigate.investigateIncident.execute({
                tenantId: tenantId(tid),
                incidentId: incidentId(iid),
                suggestedAgents,
            });
        },
    });

    const shutdown = (sig: string) => {
        logger.info({ sig }, 'causeflow-worker BullMQ consumer shutting down');
        consumer.stop().then(() => process.exit(0)).catch(() => process.exit(1));
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

if (BULLMQ_CONSUMER_MODE) {
    startBullConsumer().catch((err) => {
        logger.fatal({ err }, 'causeflow-worker BullMQ consumer failed to start');
        process.exit(1);
    });
} else {
    main().catch((err) => {
        logger.fatal({ err, incidentId: INCIDENT_ID, tenantId: TENANT_ID }, 'Investigation worker unhandled error');
        process.exit(1);
    });
}
