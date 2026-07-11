import { v4 as uuidv4 } from 'uuid';
import { evidenceId } from '../../../shared/domain/value-objects.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { IncidentAlreadyTriagedError, TriageFailedError } from '../domain/triage.errors.js';
import { triageResultSchema, buildTriagePrompt, TRIAGE_SYSTEM_PROMPT } from '../domain/triage.prompts.js';
import { logger } from '../../../shared/infra/logger.js';
import { config } from '../../../shared/config/index.js';
import { isLocalLlmFailClosedMode, usesLocalLlmConnector } from '../../../shared/infra/llm/llm-factory.js';
import { LlmContextTooLargeError } from '../../../shared/infra/llm/llm-context-errors.js';
import { LLM_CONTEXT_TOO_LARGE_CODE } from '../../../shared/domain/llm-connector.entity.js';
import { connectorEvidenceLabel, resolveActiveLlmEndpoint } from '../../../shared/infra/llm/llm-connector-profile.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../domain/evidence.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
import type { Tracer, Span } from '../../../shared/application/ports/tracer.port.js';
import type { TriageResult } from '../domain/triage.types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { UpdateIncidentStatusUseCase } from '../../ingestion/application/update-incident-status.usecase.js';

export interface TriageIncidentDeps {
    incidentRepo: IIncidentRepository;
    evidenceRepo: IEvidenceRepository;
    eventBus: IEventBus;
    llmClient: LLMClient;
    messageQueue?: MessageQueue;
    investigationQueueUrl?: string;
    minInvestigationSeverity?: string;
    integrationToolProvider?: IntegrationToolProvider;
    /** Whether the tenant has AWS credential vending configured */
    hasAwsCredentials?: boolean;
    /** Whether the tenant has GitHub App connected */
    hasGitHub?: boolean;
    /** Whether the tenant has Relay connected */
    hasRelay?: boolean;
    /** Use case for transitioning incident status (required for terminal triage resolution) */
    updateIncidentStatus?: UpdateIncidentStatusUseCase;
    /** Observability tracer for tracing the triage operation (AC-018). */
    tracer?: Tracer;
}

const SEVERITY_RANK: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
};
// Inline noop span/tracer to avoid importing infra from the application layer.
const _noopSpan: Span = { setAttribute() {}, setInput() {}, setOutput() {}, setUsage() {}, setStatus() {}, end() {} };
const _noopTracer: Tracer = { startSpan() { return _noopSpan; }, flush() { return Promise.resolve(); }, shutdown() { return Promise.resolve(); } };

export class TriageIncidentUseCase {
    incidentRepo;
    evidenceRepo;
    eventBus;
    llmClient;
    messageQueue;
    investigationQueueUrl;
    minInvestigationSeverity;
    integrationToolProvider;
    hasAwsCredentials;
    hasGitHub;
    hasRelay;
    updateIncidentStatus;
    tracer: Tracer;
    constructor(deps: TriageIncidentDeps);
    constructor(incidentRepo: IIncidentRepository, evidenceRepo: IEvidenceRepository, eventBus: IEventBus, llmClient: LLMClient, messageQueue?: MessageQueue, investigationQueueUrl?: string, minInvestigationSeverity?: string, integrationToolProvider?: IntegrationToolProvider, hasAwsCredentials?: boolean, hasGitHub?: boolean, hasRelay?: boolean);
    constructor(depsOrRepo: TriageIncidentDeps | IIncidentRepository, evidenceRepo?: IEvidenceRepository, eventBus?: IEventBus, llmClient?: LLMClient, messageQueue?: MessageQueue, investigationQueueUrl?: string, minInvestigationSeverity?: string, integrationToolProvider?: IntegrationToolProvider, hasAwsCredentials?: boolean, hasGitHub?: boolean, hasRelay?: boolean) {
        if (evidenceRepo !== undefined) {
            // Positional constructor (backward compatible)
            this.incidentRepo = depsOrRepo as IIncidentRepository;
            this.evidenceRepo = evidenceRepo;
            this.eventBus = eventBus as IEventBus;
            this.llmClient = llmClient as LLMClient;
            this.messageQueue = messageQueue;
            this.investigationQueueUrl = investigationQueueUrl;
            this.minInvestigationSeverity = minInvestigationSeverity ?? 'high';
            this.integrationToolProvider = integrationToolProvider;
            this.hasAwsCredentials = hasAwsCredentials ?? false;
            this.hasGitHub = hasGitHub ?? false;
            this.hasRelay = hasRelay ?? false;
            this.updateIncidentStatus = undefined;
            this.tracer = _noopTracer;
        }
        else {
            // Deps object constructor
            const deps = depsOrRepo as TriageIncidentDeps;
            this.incidentRepo = deps.incidentRepo;
            this.evidenceRepo = deps.evidenceRepo;
            this.eventBus = deps.eventBus;
            this.llmClient = deps.llmClient;
            this.messageQueue = deps.messageQueue;
            this.investigationQueueUrl = deps.investigationQueueUrl;
            this.minInvestigationSeverity = deps.minInvestigationSeverity ?? 'high';
            this.integrationToolProvider = deps.integrationToolProvider;
            this.hasAwsCredentials = deps.hasAwsCredentials ?? false;
            this.hasGitHub = deps.hasGitHub ?? false;
            this.hasRelay = deps.hasRelay ?? false;
            this.updateIncidentStatus = deps.updateIncidentStatus;
            this.tracer = deps.tracer ?? _noopTracer;
        }
    }
    async execute(tenantId: TenantId, incidentId: IncidentId): Promise<TriageResult> {
        const span = this.tracer.startSpan('triage.incident', {
            tenantId: String(tenantId),
            incidentId: String(incidentId),
        }, { userId: String(tenantId), sessionId: String(incidentId) }, 'span');

        try {
            const incident = await this.incidentRepo.findById(tenantId, incidentId);
            if (!incident) {
                span.setOutput({ error: 'Incident not found' });
                span.setStatus('error', 'Incident not found');
                span.end();
                throw new NotFoundError('Incident', incidentId);
            }
            if (incident.status !== 'open') {
                span.setOutput({ error: 'Incident not in open status', status: incident.status });
                span.setStatus('error', 'Incident not in open status');
                span.end();
                throw new IncidentAlreadyTriagedError(incidentId, incident.status);
            }

            span.setInput({
                incidentId,
                tenantId,
                title: incident.title,
                description: incident.description,
                severity: incident.severity,
                sourceProvider: incident.sourceProvider,
            });

            await this.incidentRepo.updateStatus(tenantId, incidentId, 'triaging');
            // Build integration-aware prompt
            const systemPrompt = await this.buildSmartPrompt(tenantId);
            let result: TriageResult;
            let triageLlmModel: string | undefined;
            let triageLlmConnector: string | undefined;
            try {
                const completion = await this.llmClient.complete<TriageResult>({
                    systemPrompt,
                    userPrompt: buildUserPrompt(incident),
                    model: config.anthropic.triageModel,
                    maxTokens: usesLocalLlmConnector() ? 1024 : 512,
                    temperature: 0,
                    responseSchema: triageResultSchema,
                    attributes: { tenantId: String(tenantId), incidentId: String(incidentId) },
                });
                result = completion.content;
                triageLlmModel = completion.model;
                const endpoint = await resolveActiveLlmEndpoint();
                triageLlmConnector = connectorEvidenceLabel(endpoint.connectorId);
                // Guard against stub/LLM bodies that parse loosely but omit fields
                // required to dispatch investigation (AC-046).
                const validated = triageResultSchema.safeParse(result);
                if (!validated.success || !result.suggestedAgents?.length) {
                    throw new Error(
                        validated.success
                            ? 'Triage result missing suggestedAgents'
                            : `Invalid triage result: ${validated.error.message}`,
                    );
                }
                result = validated.data;
            }
            catch (err) {
                if (err instanceof LlmContextTooLargeError) {
                    await this.incidentRepo.updateStatus(tenantId, incidentId, 'failed');
                    throw new TriageFailedError(String(incidentId), `${LLM_CONTEXT_TOO_LARGE_CODE}: ${err.message}`);
                }
                if (isLocalLlmFailClosedMode()) {
                    const reason = err instanceof Error ? err.message : 'Local LLM connector unavailable';
                    await this.incidentRepo.updateStatus(tenantId, incidentId, 'failed');
                    throw new TriageFailedError(String(incidentId), reason);
                }
                // If LLM is unavailable (e.g., no API key configured), fall back so the
                // local-only pipeline still reaches investigation (AC-046 / AC-041).
                // Use high severity + the six foundational agents so the investigation
                // worker runs and emits per-agent progress without SaaS credentials.
                logger.warn({ incidentId, err: err instanceof Error ? err.message : String(err) }, 'LLM triage failed — using fallback default');
                result = {
                    priority: 'high',
                    summary: 'Triage completed via fallback (LLM unavailable). Assigned default high severity for local investigation.',
                    suggestedAgents: [
                        'log_analyst',
                        'metric_analyst',
                        'change_detector',
                        'code_analyzer',
                        'infra_inspector',
                        'db_analyst',
                    ],
                    confidence: 0,
                    category: 'unknown',
                    investigationMode: 'orchestrator',
                };
            }

            // AC-060: Ornith/local 9B models are unreliable on hypothesis/debate
            // seeker schemas (missing `hypotheses`). Keep the OSS golden path on
            // orchestrator mode so triage → investigation → remediation completes.
            if (usesLocalLlmConnector() && result.investigationMode !== 'orchestrator') {
                logger.info(
                    {
                        incidentId,
                        from: result.investigationMode,
                        to: 'orchestrator',
                    },
                    'Local LLM triage — coercing investigationMode to orchestrator',
                );
                result = { ...result, investigationMode: 'orchestrator' };
            }

            await this.incidentRepo.update(tenantId, incidentId, {
                severity: result.priority,
                assignedAgents: result.suggestedAgents,
                investigationMode: result.investigationMode,
                updatedAt: new Date().toISOString(),
            });

            // Evidence persistence is best-effort — the database backing may not be
            // available in all runtimes (e.g., OSS mode lacks a PgEvidenceRepository),
            // and a failure here must not block the rest of the triage flow.
            try {
                await this.evidenceRepo.create({
                    tenantId,
                    incidentId,
                    evidenceId: evidenceId(uuidv4()),
                    agentRole: 'coordinator',
                    evidenceType: 'agent_reasoning',
                    content: result.summary,
                    metadata: {
                        confidence: result.confidence,
                        category: result.category,
                        ...(triageLlmModel
                            ? {
                                source: 'llm_completion',
                                llmModel: triageLlmModel,
                                llmConnector: triageLlmConnector ?? 'local',
                                phase: 'triage',
                              }
                            : {}),
                    },
                    createdAt: new Date().toISOString(),
                });
            }
            catch (evidenceErr) {
                logger.warn({ incidentId, err: evidenceErr instanceof Error ? evidenceErr.message : String(evidenceErr) }, 'Failed to persist triage evidence — non-critical');
            }

            // Fire severity_changed event when AI assigns a new severity (AC-033)
            if (result.priority !== incident.severity) {
                await this.eventBus.publish({
                    eventType: 'incident.severity_changed',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: {
                        incidentId,
                        severity: result.priority,
                        previousSeverity: incident.severity,
                        title: incident.title,
                    },
                });
            }

            await this.eventBus.publish({
                eventType: 'incident.status_changed',
                occurredAt: new Date().toISOString(),
                tenantId,
                payload: {
                    incidentId,
                    from: 'open',
                    to: 'triaging',
                    title: incident.title,
                    severity: result.priority,
                },
            });

            const threshold = SEVERITY_RANK[this.minInvestigationSeverity] ?? 1;
            const resultRank = SEVERITY_RANK[result.priority] ?? 4;
            if (resultRank <= threshold) {
                // High-severity path: dispatch to investigation worker
                if (this.messageQueue && this.investigationQueueUrl) {
                    await this.messageQueue.send(this.investigationQueueUrl, {
                        incidentId,
                        tenantId,
                        severity: result.priority,
                        suggestedAgents: result.suggestedAgents,
                        investigationMode: result.investigationMode,
                    });
                }
            } else {
                // Terminal path: low/medium/info — resolve immediately without investigation
                // Mirror investigate-incident pattern: write rootCause first, then transition status
                await this.incidentRepo.update(tenantId, incidentId, {
                    rootCause: result.summary,
                    updatedAt: new Date().toISOString(),
                });
                if (this.updateIncidentStatus) {
                    await this.updateIncidentStatus.execute(tenantId, incidentId, 'resolved');
                } else {
                    // Fallback when updateIncidentStatus not wired (positional constructor path)
                    await this.incidentRepo.updateStatus(tenantId, incidentId, 'resolved');
                    await this.eventBus.publish({
                        eventType: 'incident.status_changed',
                        occurredAt: new Date().toISOString(),
                        tenantId,
                        payload: { incidentId, from: 'triaging', to: 'resolved', title: incident.title },
                    });
                }
            }

            // Set the span output to include the triage result + audit chain info
            span.setOutput({
                priority: result.priority,
                category: result.category,
                confidence: result.confidence,
                summary: result.summary,
                investigationMode: result.investigationMode,
                incidentStatus: 'triaging',
                incidentUpdated: true,
                auditChainUpdated: true,
            });
            span.setStatus('ok');
            span.end();

            return result;
        } catch (err) {
            // If an error is re-thrown from known error types above, it's already
            // recorded on the span. For unexpected errors, record them here.
            span.setOutput({ error: err instanceof Error ? err.message : String(err) });
            span.setStatus('error', err instanceof Error ? err.message : 'Unknown error');
            span.end();
            throw err;
        }
    }
    /**
     * Build an integration-aware triage prompt.
     * Fetches connected integrations from the provider (fast, cached call)
     * and combines with static infra knowledge (AWS, GitHub, Relay).
     */
    async buildSmartPrompt(tenantId: TenantId): Promise<string> {
        const connectedIntegrations = [];
        // Add static integrations (no network call needed — known from bootstrap config)
        if (this.hasAwsCredentials)
            connectedIntegrations.push('AWS');
        if (this.hasGitHub)
            connectedIntegrations.push('GitHub');
        if (this.hasRelay)
            connectedIntegrations.push('Relay');
        // Fetch dynamic integrations from Composio (if configured)
        if (this.integrationToolProvider) {
            try {
                const connections = await this.integrationToolProvider.getConnectionStatus(tenantId);
                for (const conn of connections) {
                    if (conn.status === 'connected' && !connectedIntegrations.includes(conn.provider)) {
                        connectedIntegrations.push(conn.provider);
                    }
                }
            }
            catch (err) {
                logger.warn({ err, tenantId }, 'Failed to fetch integration status for triage — using defaults');
            }
        }
        // If no integrations detected, fall back to default prompt
        if (connectedIntegrations.length === 0) {
            return TRIAGE_SYSTEM_PROMPT;
        }
        return buildTriagePrompt(connectedIntegrations);
    }
}
function buildUserPrompt(incident: { title: string; description: string; severity: string; sourceProvider: string; sourceAlertId: string }): string {
    return `Incident to triage:
- Title: ${incident.title}
- Description: ${incident.description}
- Current Severity: ${incident.severity}
- Source: ${incident.sourceProvider}
- Alert ID: ${incident.sourceAlertId}`;
}
