import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { logger } from '../../../shared/infra/logger.js';
import { evidenceId, toolCallId as toToolCallId } from '../../../shared/domain/value-objects.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvestigationFailedError, IncidentNotInvestigatableError } from '../domain/investigation.errors.js';
import { CircuitBreakerOpenError, type CircuitState } from '../../../shared/infra/llm/circuit-breaker.js';
import { isLocalLlmFailClosedMode } from '../../../shared/infra/llm/llm-factory.js';
import { assertLocalLlmReachable, LOCAL_LLM_UNAVAILABLE_MESSAGE } from '../../../shared/infra/llm/local-llm-guard.js';
import { LlmContextTooLargeError } from '../../../shared/infra/llm/llm-context-errors.js';
import { LLM_CONTEXT_TOO_LARGE_CODE } from '../../../shared/domain/llm-connector.entity.js';
import { connectorEvidenceLabel, resolveActiveLlmEndpoint } from '../../../shared/infra/llm/llm-connector-profile.js';
import { AGENT_CONFIG_MAP, ORCHESTRATOR_CONFIG } from './agent-configs.js';
import { AWS_API_CALL_TOOL } from '../infra/aws-api-tool.js';
import { config } from '../../../shared/config/index.js';
import { enrichErrorWithMemory } from './intelligence/tool-errors.js';
import { collapseToolSummaries, formatCollapsedTimeline } from './intelligence/tool-summary.js';
import { retainAgentFindings, retainInvestigationSummary } from './intelligence/investigation-memory.js';
import { createCheckpointToolHandler } from '../infra/checkpoint-tools.js';
import { CITE_EVIDENCE_TOOL, createCiteEvidenceHandler } from '../infra/cite-evidence-tool.js';
import { ToolCallTracker } from '../../../shared/infra/llm/tool-call-tracker.js';
import { buildAvailableActionsPrompt } from '../domain/action-catalog.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
import type { IInvestigationChannel } from '../../../shared/application/ports/investigation-channel.port.js';
import type { IToolCallRepository } from '../../triage/domain/tool-call.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { AgentRunner } from '../../../shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { CloudProvider, CloudCredentials } from '../../../shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../shared/application/ports/credential-vendor.port.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { InvestigationResult, InvestigationInput, StructuredAction } from '../domain/investigation.types.js';
import type { IRelayGateway } from '../../../shared/application/ports/relay-gateway.port.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { SelectSkillsUseCase } from '../../skills/application/select-skills.usecase.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { SubAgentResult, SubAgentConfig, TenantCapabilities, Finding } from '../domain/investigation.types.js';
import type { Evidence } from '../../triage/domain/evidence.repository.js';
import type { IHypothesisRepository } from '../domain/hypothesis.repository.js';
import { createPendingHypothesis } from '../domain/hypothesis.entity.js';
import type { AgentRunResult, ToolCallRecord, ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { Incident } from '../../ingestion/domain/incident.entity.js';

export type ToolHandlerFactory = (deps: {
    cloudProvider: CloudProvider;
    cloudCredentials: CloudCredentials;
    incidentRepo: IIncidentRepository;
    tenantId: TenantId;
    incidentId: IncidentId;
    agentMemory?: AgentMemory;
    knownRepos?: string[];
    relayGateway?: IRelayGateway;
    integrationToolProvider?: IntegrationToolProvider;
}) => (name: string, input: Record<string, unknown>) => Promise<string>;

export interface InvestigateIncidentDeps {
    incidentRepo: IIncidentRepository;
    evidenceRepo: IEvidenceRepository;
    toolCallRepo: IToolCallRepository;
    eventBus: IEventBus;
    agentRunner: AgentRunner;
    llmClient: LLMClient;
    cloudProvider: CloudProvider;
    credentialVendor?: CredentialVendor;
    toolHandlerFactory: ToolHandlerFactory;
    messageQueue?: MessageQueue;
    remediationQueueUrl?: string;
    defaultRegion?: string;
    synthesisModel?: string;
    relayGateway?: IRelayGateway;
    integrationToolProvider?: IntegrationToolProvider;
    agentMemory?: AgentMemory;
    selectSkills?: SelectSkillsUseCase;
    hypothesisRepo?: IHypothesisRepository;
    circuitBreaker?: { getState(): CircuitState; onFailure(): void };
    /** AC-057: optional hook to persist stub-upstream probe evidence on the incident. */
    persistStubUpstreamEvidence?: (tenantId: TenantId, incidentId: IncidentId) => Promise<void>;
}

/**
 * Build a rich summary from agent response + tool call results.
 * The synthesizer needs BOTH the agent's reasoning AND the raw data it found.
 */
/** Truncate tool input values for WS transmission — keeps messages small */
function sanitizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
    const MAX_VALUE_CHARS = 200;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string' && value.length > MAX_VALUE_CHARS) {
            sanitized[key] = value.slice(0, MAX_VALUE_CHARS) + '…';
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// Evidence is now created exclusively via the `cite_evidence` tool.
// The previous hardcoded classifier (classifyToolEvidence / extractToolEvidence)
// was removed in favor of deterministic agent-driven citation with literal quotes.

/**
 * Convert a list of finding strings (e.g. from a failed-synthesis fallback
 * in multi-agent mode) into the structured Finding shape.
 * NOTE: these findings carry no citation — only used in the non-orchestrator path.
 */
function stringsToFindings(findings: string[]): Finding[] {
    return findings.map((text) => ({ text, evidenceIds: [] }));
}

/**
 * Strict continuation prompt used when the orchestrator produced zero evidences
 * on its first run. Injected as the user prompt for the single bounded re-invocation.
 */
const ORCHESTRATOR_REINVOCATION_PROMPT = `You produced findings WITHOUT calling cite_evidence. This is a contract violation.

Re-do the investigation. For EVERY claim you make, you MUST first call cite_evidence
with the supporting tool output (specifying toolCallId, claim text, and a verbatim quote
from the tool output).

If after exhaustive tool use you cannot find supporting evidence, terminate WITHOUT
producing findings. There is no fallback. Un-cited findings will be discarded and the
investigation marked inconclusive.

Do not produce a finding without a corresponding cite_evidence call.`;

/**
 * Render the list of Evidence records into a compact block the synthesizer
 * can cite from. Each row is a single line: [evidenceId] claim — "quote".
 * Only the fields needed for citation are emitted to keep the prompt short.
 */
function buildAvailableEvidenceBlock(evidences: Evidence[]): string {
    if (evidences.length === 0) {
        return '\n\nAVAILABLE EVIDENCE: (none — the orchestrator did not call cite_evidence)';
    }
    const MAX_CLAIM = 200;
    const MAX_QUOTE = 120;
    const rows = evidences.map((ev) => {
        const claim = (ev.claim ?? ev.content ?? '').slice(0, MAX_CLAIM);
        const quote = (ev.quote ?? '').slice(0, MAX_QUOTE);
        const tool = ev.metadata?.toolName ?? 'unknown';
        return `[${ev.evidenceId}] ${claim} — ${JSON.stringify(quote)} (source: ${tool})`;
    });
    return `\n\nAVAILABLE EVIDENCE (cite these evidenceIds verbatim in findings[].evidenceIds):\n${rows.join('\n')}`;
}

function buildAgentSummary(response: string, toolCalls: Array<{ name: string; input: Record<string, unknown>; output: string }>): string {
    const MAX_RESPONSE = 800;
    const MAX_TOOL_OUTPUT = 500;

    // Agent's conclusion (full response, truncated)
    const agentResponse = response.length > MAX_RESPONSE ? response.slice(0, MAX_RESPONSE) + '...' : response;

    // Key tool call results (filter out memory tools, include data-bearing tools)
    const dataTools = toolCalls.filter(tc =>
        !['remember_finding', 'recall_past_incidents', 'get_service_topology', 'get_recent_changes', 'check_remediation_history', 'get_incident_details'].includes(tc.name) &&
        !tc.output.startsWith('Tool `') // exclude failed tools
    );

    if (dataTools.length === 0) {
        return agentResponse;
    }

    const toolResults = dataTools.map(tc => {
        const output = tc.output.length > MAX_TOOL_OUTPUT ? tc.output.slice(0, MAX_TOOL_OUTPUT) + '...' : tc.output;
        const inputStr = JSON.stringify(tc.input);
        return `  - ${tc.name}(${inputStr.length > 100 ? inputStr.slice(0, 100) + '...' : inputStr}): ${output}`;
    }).join('\n');

    return `${agentResponse}\n\nTool Results:\n${toolResults}`;
}
function formatWaveFindings(results: SubAgentResult[]): string {
    if (results.length === 0)
        return '';
    const sections = results.map((r: SubAgentResult) => `### ${r.agentRole} (confidence: ${(r.confidence * 100).toFixed(0)}%)\n${r.findings.join('\n')}`);
    return `\n\nPRELIMINARY FINDINGS FROM INITIAL ANALYSIS:\n${sections.join('\n\n')}\n\nUse these findings to focus your investigation. Confirm, refute, or build upon them.`;
}
function calculateConfidence(result: AgentRunResult): number {
    let score = 0.4; // base
    // Tool calls made (agent actually investigated)
    if (result.toolCalls.length > 0)
        score += 0.1;
    if (result.toolCalls.length >= 3)
        score += 0.1;
    // Tool call success rate (check for error patterns in outputs)
    const ERROR_PATTERNS = ['access denied', 'not found', 'error', 'failed', 'timeout'];
    const successfulCalls = result.toolCalls.filter((tc: ToolCallRecord) => {
        const lower = tc.output.toLowerCase();
        return !ERROR_PATTERNS.some((p) => lower.includes(p)) && tc.output.length > 10;
    });
    const successRate = result.toolCalls.length > 0
        ? successfulCalls.length / result.toolCalls.length
        : 0;
    score += successRate * 0.2; // 0 to 0.2 based on success rate
    // Response quality
    if (result.response.length > 300)
        score += 0.05;
    if (result.response.match(/root cause|caused by|identified|confirmed/i))
        score += 0.1;
    if (!result.response.match(/unable to|could not|failed to|no data/i))
        score += 0.05;
    return Math.min(0.95, Math.max(0.1, score));
}
const investigationResultSchema = z.object({
    findings: z.array(z.object({
        text: z.string().min(5),
        evidenceIds: z.array(z.string()).min(1, 'Each finding must cite at least one evidenceId'),
    })).min(1, 'At least one finding is required'),
    potentialRootCause: z.string(),
    recommendedActions: z.array(z.object({
        action: z.string(),
        label: z.string(),
        description: z.string(),
        rationale: z.string(),
        riskLevel: z.enum(['low', 'medium', 'high']),
        estimatedDuration: z.string(),
        automated: z.boolean().default(false),
        params: z.record(z.unknown()).default({}),
    })),
    evidence: z.array(z.object({ type: z.string(), content: z.string() })).default([]),
    customerExplanation: z.object({
        summary: z.string(),
        impact: z.string(),
        resolution: z.string(),
        eta: z.string().optional(),
    }).optional(),
});
const SYNTHESIS_SYSTEM_PROMPT = `You are an SRE investigation synthesizer. Combine findings from multiple specialist agents into a unified root cause analysis.

Analyze all agent findings and produce:
1. A consolidated list of key findings
2. The most likely root cause based on all evidence
3. Recommended remediation actions — propose WHATEVER actions the evidence calls for
4. Supporting evidence for each conclusion

## Remediation Actions

You are NOT limited to a predefined list. Based on the investigation evidence, propose the exact actions needed to resolve THIS incident. Think like a senior SRE: what would YOU do right now?

Actions can be anything:
- Infrastructure changes (restart, scale, rollback, failover, DNS switch, config change)
- Code fixes (patch, PR, hotfix, feature flag toggle)
- Data operations (cache flush, queue drain, DB migration, data backfill)
- Observability (add alert, create dashboard, enable tracing, increase log level)
- Communication (page oncall, notify customers, update status page, post-mortem)
- Or anything else the situation demands

For each action, provide:
- action: a descriptive snake_case identifier (e.g. "drain_stuck_sqs_messages", "add_index_on_orders_created_at")
- label: human-readable name
- description: what this action will do in the context of THIS specific incident — be concrete, cite numbers and service names from the evidence
- rationale: WHY this action addresses the root cause, referencing specific findings
- riskLevel: low, medium, or high — based on blast radius and reversibility
- estimatedDuration: realistic estimate
- automated: true if the system can execute this automatically, false if it requires manual intervention
- params: any parameters needed (service names, thresholds, queue URLs, etc. — inferred from evidence)

${buildAvailableActionsPrompt()}

If an action matches one from the automatable list above, use that exact action identifier and set automated=true.
For all other actions, use a descriptive snake_case identifier and set automated=false.

Order actions by priority: most impactful first, quick wins before long-running operations.

## Evidence Citation — MANDATORY

You will receive a block labeled "AVAILABLE EVIDENCE" listing every Evidence record that the orchestrator recorded via cite_evidence during the investigation. Each row has:
  [evidenceId] claim — quote (source: toolName)

Every finding you produce MUST cite one or more of those evidenceIds. The validator refuses the synthesis if any evidenceId you reference is not in the list. Do NOT invent ids. Do NOT leave evidenceIds empty.

Respond in JSON format:
{
  "findings": [
    { "text": "finding1", "evidenceIds": ["ev_xxx", "ev_yyy"] },
    { "text": "finding2", "evidenceIds": ["ev_zzz"] }
  ],
  "potentialRootCause": "The root cause analysis...",
  "recommendedActions": [
    {
      "action": "restart_service",
      "label": "Restart API Server",
      "description": "Rolling restart of api-server to clear 847 saturated connections found by infra inspector",
      "rationale": "Connection pool at 98% capacity (847/864) with 12 stuck connections older than 2h",
      "riskLevel": "low",
      "estimatedDuration": "~2 min",
      "automated": true,
      "params": {"service": "api-server", "region": "sa-east-1"}
    },
    {
      "action": "add_index_on_orders_created_at",
      "label": "Add Index on orders.created_at",
      "description": "The slow query scan on orders table (2.3s avg) is missing an index on created_at used in the WHERE clause",
      "rationale": "Log analyst found 340 slow-query warnings in the last hour, all from the same full-table scan",
      "riskLevel": "medium",
      "estimatedDuration": "~20 min",
      "automated": false,
      "params": {"table": "orders", "column": "created_at"}
    }
  ],
  "evidence": [{"type": "log_analysis|metric_analysis|infra_state", "content": "..."}],
  "customerExplanation": {
    "summary": "Brief non-technical summary of what happened",
    "impact": "What impact this had on end users",
    "resolution": "What is being done to fix it",
    "eta": "Estimated time to resolution (optional, e.g. '30 minutes')"
  }
}`;
export class InvestigateIncidentUseCase {
    incidentRepo;
    evidenceRepo;
    toolCallRepo;
    eventBus;
    agentRunner;
    llmClient;
    cloudProvider;
    credentialVendor;
    toolHandlerFactory;
    messageQueue;
    remediationQueueUrl;
    defaultRegion;
    synthesisModel;
    relayGateway;
    integrationToolProvider;
    agentMemory;
    selectSkills;
    hypothesisRepo;
    circuitBreaker;
    persistStubUpstreamEvidence;
    constructor(deps: InvestigateIncidentDeps) {
        this.incidentRepo = deps.incidentRepo;
        this.evidenceRepo = deps.evidenceRepo;
        this.toolCallRepo = deps.toolCallRepo;
        this.eventBus = deps.eventBus;
        this.agentRunner = deps.agentRunner;
        this.llmClient = deps.llmClient;
        this.cloudProvider = deps.cloudProvider;
        this.credentialVendor = deps.credentialVendor;
        this.toolHandlerFactory = deps.toolHandlerFactory;
        this.messageQueue = deps.messageQueue;
        this.remediationQueueUrl = deps.remediationQueueUrl;
        this.defaultRegion = deps.defaultRegion ?? 'sa-east-1';
        this.synthesisModel = deps.synthesisModel;
        this.relayGateway = deps.relayGateway;
        this.integrationToolProvider = deps.integrationToolProvider;
        this.agentMemory = deps.agentMemory;
        this.selectSkills = deps.selectSkills;
        this.hypothesisRepo = deps.hypothesisRepo;
        this.circuitBreaker = deps.circuitBreaker;
        this.persistStubUpstreamEvidence = deps.persistStubUpstreamEvidence;
    }

    private isCircuitBreakerFailure(err: unknown): boolean {
        return err instanceof CircuitBreakerOpenError
            || (err instanceof Error && err.name === 'CircuitBreakerOpenError');
    }

    private failIfCircuitBreakerOpen(incidentId: IncidentId): void {
        if (this.circuitBreaker?.getState() === 'open') {
            throw new InvestigationFailedError(
                String(incidentId),
                'Circuit breaker is open. LLM service unavailable.',
            );
        }
    }

    private failClosedIfLocalLlmMode(incidentId: IncidentId, reason = LOCAL_LLM_UNAVAILABLE_MESSAGE): void {
        if (isLocalLlmFailClosedMode()) {
            throw new InvestigationFailedError(String(incidentId), reason);
        }
    }

    /** AC-057 / AC-059: persist attributable OSS LLM completion evidence on the incident. */
    private async persistLlmCompletionEvidence(params: {
        tenantId: TenantId;
        incidentId: IncidentId;
        model: string;
        phase: 'synthesis' | 'investigation';
        agentRole: SubAgentResult['agentRole'];
        content: string;
        llmConnector?: string;
    }): Promise<void> {
        try {
            const endpoint = params.llmConnector
                ? null
                : await resolveActiveLlmEndpoint();
            const llmConnector = params.llmConnector
                ?? (endpoint ? connectorEvidenceLabel(endpoint.connectorId) : 'local');
            await this.evidenceRepo.create({
                tenantId: params.tenantId,
                incidentId: params.incidentId,
                evidenceId: evidenceId(uuidv4()),
                agentRole: params.agentRole,
                evidenceType: 'agent_reasoning',
                content: params.content,
                metadata: {
                    source: 'llm_completion',
                    llmModel: params.model,
                    llmConnector,
                    phase: params.phase,
                },
                createdAt: new Date().toISOString(),
            });
        } catch (err) {
            logger.warn(
                { err, incidentId: params.incidentId, model: params.model, phase: params.phase },
                'Failed to persist LLM completion evidence — non-critical',
            );
        }
    }

    private async persistInvestigationArtifacts(params: {
        tenantId: TenantId;
        incidentId: IncidentId;
        agentRoles: string[];
        rootCause: string;
        agentDetails?: Array<{ role: string; content: string; confidence: number }>;
    }): Promise<void> {
        const { tenantId, incidentId, agentRoles, rootCause, agentDetails } = params;
        const now = new Date().toISOString();
        for (const role of agentRoles) {
            const detail = agentDetails?.find((d) => d.role === role);
            await this.evidenceRepo.create({
                tenantId,
                incidentId,
                evidenceId: evidenceId(uuidv4()),
                agentRole: role as SubAgentResult['agentRole'],
                evidenceType: 'agent_reasoning',
                content: detail?.content ?? `Agent ${role} completed investigation`,
                metadata: { confidence: detail?.confidence ?? 0 },
                createdAt: now,
            });
        }
        await this.evidenceRepo.create({
            tenantId,
            incidentId,
            evidenceId: evidenceId(uuidv4()),
            agentRole: 'coordinator',
            evidenceType: 'agent_reasoning',
            content: rootCause,
            metadata: { source: 'synthesis', confidence: 0 },
            createdAt: now,
        });
        if (!this.hypothesisRepo) return;
        const rootHypothesisId = uuidv4();
        await this.hypothesisRepo.create({
            ...createPendingHypothesis({
                hypothesisId: rootHypothesisId,
                tenantId,
                incidentId,
                statement: rootCause,
                confidence: 0.5,
                rationale: 'Synthesized root cause',
            }),
            status: 'confirmed',
            finalScore: 50,
        });
        for (const role of agentRoles) {
            const detail = agentDetails?.find((d) => d.role === role);
            await this.hypothesisRepo.create(createPendingHypothesis({
                hypothesisId: uuidv4(),
                tenantId,
                incidentId,
                statement: detail?.content ?? `Contributing factor from ${role}`,
                confidence: detail?.confidence ?? 0,
                parentId: rootHypothesisId,
                rationale: `Agent ${role} finding`,
            }));
        }
    }

    private async persistHypothesisTree(params: {
        tenantId: TenantId;
        incidentId: IncidentId;
        rootCause: string;
        agentResults: SubAgentResult[];
    }): Promise<void> {
        if (!this.hypothesisRepo) return;
        const { tenantId, incidentId, rootCause, agentResults } = params;
        const rootHypothesisId = uuidv4();
        await this.hypothesisRepo.create({
            ...createPendingHypothesis({
                hypothesisId: rootHypothesisId,
                tenantId,
                incidentId,
                statement: rootCause,
                confidence: 0.8,
                rationale: 'Synthesized root cause',
            }),
            status: 'confirmed',
            finalScore: 80,
        });
        for (const agentResult of agentResults) {
            const statement = agentResult.findings.join('\n') || `Finding from ${agentResult.agentRole}`;
            await this.hypothesisRepo.create(createPendingHypothesis({
                hypothesisId: uuidv4(),
                tenantId,
                incidentId,
                statement,
                confidence: agentResult.confidence,
                parentId: rootHypothesisId,
                rationale: `Agent ${agentResult.agentRole} finding`,
            }));
        }
    }
    /**
     * Query tenant integrations to determine what the tenant has connected.
     * Checks AWS (via credential vending), Composio connections, and relay gateway.
     */
    /**
     * Run the synthesis LLM with deterministic citation validation. Fetches the
     * current Evidence list for the incident, renders it as a citation menu, and
     * rejects any synthesis that references an evidenceId that doesn't exist.
     * Retries up to `maxRetries` times with a correction prompt, then falls back
     * to raising the last error to the caller.
     */
    private async synthesizeWithValidation(params: {
        tenantId: TenantId;
        incidentId: IncidentId;
        baseSynthesisPrompt: string;
        maxRetries?: number;
    }): Promise<{ result: InvestigationResult; costUsd: number; evidences: Evidence[] }> {
        const maxRetries = params.maxRetries ?? 2;
        const evidences = await this.evidenceRepo.findByIncident(params.tenantId, params.incidentId);
        const validIds = new Set(evidences.map((e) => e.evidenceId as string));
        const evidenceBlock = buildAvailableEvidenceBlock(evidences);

        let userPrompt = params.baseSynthesisPrompt + evidenceBlock;
        let totalCost = 0;
        let lastErr: unknown;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const completion = await this.llmClient.complete({
                    model: this.synthesisModel,
                    systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
                    userPrompt,
                    maxTokens: 4096,
                    temperature: 0,
                    responseSchema: investigationResultSchema,
                });
                totalCost += completion.costUsd;
                const parsed = completion.content as InvestigationResult;

                // Deterministic validation: every cited evidenceId must exist.
                const invalidRefs: Array<{ finding: string; badIds: string[] }> = [];
                for (const f of parsed.findings) {
                    const bad = (f.evidenceIds ?? []).filter((id) => !validIds.has(id));
                    if (bad.length > 0) invalidRefs.push({ finding: f.text, badIds: bad });
                }
                if (invalidRefs.length === 0) {
                    await this.persistLlmCompletionEvidence({
                        tenantId: params.tenantId,
                        incidentId: params.incidentId,
                        model: completion.model,
                        phase: 'synthesis',
                        agentRole: 'orchestrator',
                        content: `Investigation synthesis completed via ${completion.model}`,
                    });
                    return { result: parsed, costUsd: totalCost, evidences };
                }

                // Build correction prompt and loop.
                const details = invalidRefs
                    .map((r) => `  - Finding "${r.finding.slice(0, 80)}" cites unknown ids: ${r.badIds.join(', ')}`)
                    .join('\n');
                logger.warn({
                    incidentId: params.incidentId,
                    attempt,
                    invalidRefs,
                }, 'Synthesis referenced unknown evidenceIds — retrying with correction');
                userPrompt =
                    params.baseSynthesisPrompt +
                    evidenceBlock +
                    `\n\nPREVIOUS ATTEMPT REJECTED — invalid evidenceId references:\n${details}\n` +
                    `Re-produce the synthesis using ONLY the evidenceIds from AVAILABLE EVIDENCE above.`;
            } catch (err) {
                if (err instanceof LlmContextTooLargeError) {
                    throw new InvestigationFailedError(
                        String(params.incidentId),
                        `${LLM_CONTEXT_TOO_LARGE_CODE}: ${err.message}`,
                    );
                }
                lastErr = err;
                logger.warn({ err, incidentId: params.incidentId, attempt }, 'Synthesis attempt failed');
                // fall through to retry; if this was the last attempt, loop exits
            }
        }

        throw new Error(
            `Synthesis failed after ${maxRetries + 1} attempts (${evidences.length} evidences available). Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
        );
    }

    /**
     * Persist a synthetic tool call representing agent memory I/O.
     * Makes pre-prompt memory injections citable via a toolCallId like any other tool call.
     * Non-fatal — if persistence fails, investigation continues.
     */
    private async logSyntheticMemoryCall(params: {
        tenantId: TenantId;
        incidentId: IncidentId;
        name: 'memory_recall' | 'memory_reflect';
        input: Record<string, unknown>;
        output: string;
        label?: string;
        tracker?: ToolCallTracker;
    }): Promise<string | null> {
        const MAX_OUTPUT_BYTES = 100_000;
        const output = params.output.length > MAX_OUTPUT_BYTES
            ? params.output.slice(0, MAX_OUTPUT_BYTES) + '\n\n[truncated]'
            : params.output;
        // Register in tracker (if provided) so the agent can cite this memory I/O via cite_evidence.
        const tcId = params.tracker
            ? params.tracker.register(params.name, params.input, output)
            : `tc_${uuidv4().slice(0, 8)}`;
        try {
            await this.toolCallRepo.create({
                tenantId: params.tenantId,
                incidentId: params.incidentId,
                toolCallId: toToolCallId(tcId),
                agentRole: 'orchestrator',
                name: params.name,
                origin: 'synthetic_memory',
                input: params.input,
                output,
                success: output.length > 0,
                metadata: params.label ? { label: params.label } : undefined,
                createdAt: new Date().toISOString(),
            });
            return tcId;
        } catch (err) {
            logger.warn({ err, incidentId: params.incidentId, name: params.name }, 'Failed to persist synthetic memory tool call');
            return null;
        }
    }

    async buildTenantCapabilities(tenantId: TenantId): Promise<TenantCapabilities> {
        let hasAws = false;
        if (this.credentialVendor) {
            try {
                const creds = await this.credentialVendor.vend({
                    tenantId,
                    incidentId: '' as IncidentId,
                    agentRole: 'scout',
                    provider: this.cloudProvider.name,
                    requestedPermissions: [],
                });
                hasAws = creds.provider !== 'stub' && !!creds.credentials['accessKeyId'];
            } catch {
                hasAws = false;
            }
        }

        let composioApps: string[] = [];
        if (this.integrationToolProvider) {
            try {
                const connections = await this.integrationToolProvider.getConnectionStatus(tenantId);
                composioApps = connections
                    .filter(c => c.status === 'connected')
                    .map(c => c.provider);
            } catch { /* degrade gracefully */ }
        }

        const hasRelay = this.relayGateway?.isConnected(tenantId) ?? false;

        return { hasAws, composioApps, hasRelay };
    }

    /**
     * Assemble tools for an agent based on its baseRole and tenant capabilities.
     * If the agent has no baseRole, returns its static tools unchanged.
     */
    buildToolsForAgent(
        agentConfig: SubAgentConfig,
        capabilities: TenantCapabilities,
        composioTools: ToolDefinition[],
    ): ToolDefinition[] {
        const { baseRole } = agentConfig;

        // No baseRole — use static tools as-is (e.g. skill agents)
        if (!baseRole) {
            return composioTools.length > 0
                ? [...agentConfig.tools, ...composioTools]
                : agentConfig.tools;
        }

        // Orchestrator: assemble ALL available tools
        if (baseRole === 'orchestrator') {
            const tools: ToolDefinition[] = [...agentConfig.tools];
            if (capabilities.hasAws && !tools.some(t => t.name === 'aws_api_call')) {
                tools.push(AWS_API_CALL_TOOL);
            }
            if (composioTools.length > 0) {
                tools.push(...composioTools);
            }
            if (!tools.some(t => t.name === 'cite_evidence')) {
                tools.push(CITE_EVIDENCE_TOOL);
            }
            return tools;
        }

        // Start with the agent's base static tools (already include incidentDetailsTool + MEMORY_TOOLS)
        const tools: ToolDefinition[] = [...agentConfig.tools];

        // Add AWS tools if tenant has AWS integration
        if (capabilities.hasAws) {
            // Only add AWS_API_CALL_TOOL if not already present
            if (!tools.some(t => t.name === 'aws_api_call')) {
                tools.push(AWS_API_CALL_TOOL);
            }
        }

        // Add Composio tools
        if (composioTools.length > 0) {
            tools.push(...composioTools);
        }

        return tools;
    }

    /**
     * Build a capabilities section for the agent system prompt describing what
     * infrastructure access is available. Only lists what the tenant actually has.
     */
    buildCapabilitiesPrompt(capabilities: TenantCapabilities, composioApps: string[]): string {
        const lines: string[] = [];

        if (capabilities.hasAws) {
            lines.push('- **AWS** via `aws_api_call` — CloudWatch logs/metrics, ECS/EC2/RDS/Route53/CloudFront/Lambda (read-only). Primary source for infrastructure state. See the main methodology above.');
        }

        // Prescriptive guidance per connected Composio app: WHAT the tool gives you and WHEN to reach for it.
        // Tools are namespaced `composio_<APP>_<ACTION>` (e.g. composio_NOTION_SEARCH_PAGES).
        const appGuidance: Record<string, string> = {
            github: '- **GitHub** via `composio_GITHUB_*` — recent PRs, commits, issues, releases. Trigger: incident started after a deploy, or you suspect a code change. Start with `composio_GITHUB_PULLS_LIST` (state=closed, sort=updated) for merges in the last 24-48h on the affected service repo.',
            gitlab: '- **GitLab** via `composio_GITLAB_*` — merge requests, commits, pipelines. Trigger: same as GitHub — correlate recent merges with incident timeline.',
            bitbucket: '- **Bitbucket** via `composio_BITBUCKET_*` — PRs, commits, repositories. Trigger: check recent PRs on the affected service repo.',
            slack: '- **Slack** via `composio_SLACK_*` — messages, channels, threads. Trigger: ALWAYS before concluding — search #incidents, #engineering, #oncall for ongoing discussion about the same symptoms. Saves duplicate investigation work.',
            teams: '- **Microsoft Teams** via `composio_TEAMS_*` — messages, channels. Trigger: same as Slack — search for ongoing discussion before concluding.',
            discord: '- **Discord** via `composio_DISCORD_*` — messages, channels. Trigger: search for ongoing discussion before concluding.',
            jira: '- **Jira** via `composio_JIRA_*` — tickets, epics, sprints. Trigger: unexpected service behavior may have a known issue ticket. Search by affected service name or recent labels.',
            linear: '- **Linear** via `composio_LINEAR_*` — issues, projects, cycles. Trigger: same as Jira — look for open/recently-closed issues on the affected component.',
            trello: '- **Trello** via `composio_TRELLO_*` — boards, cards. Trigger: search cards for the affected service in active lists.',
            shortcut: '- **Shortcut** via `composio_SHORTCUT_*` — stories, iterations, epics. Trigger: check current iteration for stories touching the affected service; recently-completed stories may have introduced the change.',
            clickup: '- **ClickUp** via `composio_CLICKUP_*` — tasks, spaces. Trigger: search tasks for the affected service.',
            asana: '- **Asana** via `composio_ASANA_*` — tasks, projects. Trigger: search tasks for the affected service.',
            notion: '- **Notion** via `composio_NOTION_*` — runbooks, architecture docs, ADRs, postmortems. Trigger: symptom you don\'t recognize, service behavior that seems intentional but unclear, or before recommending risky remediation — check for a documented runbook or prior postmortem.',
            confluence: '- **Confluence** via `composio_CONFLUENCE_*` — runbooks, architecture docs. Trigger: same as Notion — check for documented runbook before concluding.',
            datadog: '- **Datadog** via `composio_DATADOG_*` — monitors, metrics, logs. Trigger: use instead of/in addition to CloudWatch when tenant uses Datadog as primary observability.',
            sentry: '- **Sentry** via `composio_SENTRY_*` — errors, issues, releases. Trigger: if incident is application-level (5xx, exceptions), check Sentry for the spike — group by release to correlate with deploys.',
            pagerduty: '- **PagerDuty** via `composio_PAGERDUTY_*` — incidents, services, schedules. Trigger: check if a related PagerDuty incident is already open (avoid duplicate investigation) and who\'s on-call for the affected service.',
            newrelic: '- **New Relic** via `composio_NEWRELIC_*` — APM, alerts, dashboards. Trigger: APM transactions, dependency maps when tenant uses New Relic.',
            hubspot: '- **HubSpot** via `composio_HUBSPOT_*` — customer context. Trigger: when incident has customer-facing impact and you need to understand the account affected.',
            zendesk: '- **Zendesk** via `composio_ZENDESK_*` — support tickets. Trigger: check for customer tickets reporting the same symptom — confirms scope and customer impact.',
            intercom: '- **Intercom** via `composio_INTERCOM_*` — customer conversations. Trigger: same as Zendesk — confirm customer-facing impact.',
        };

        for (const app of composioApps) {
            lines.push(appGuidance[app] ?? `- **${app}** via \`composio_${app.toUpperCase()}_*\` — connected integration, use when relevant to the incident.`);
        }

        if (capabilities.hasRelay) {
            lines.push('- **Database (live)** via `db_*` tools — PostgreSQL/MongoDB read-only through secure relay. Trigger: you need to verify actual data state (row counts, recent inserts, schema), not just logs about data.');
        }

        if (lines.length === 0) {
            return '\n\nAvailable integrations: None — only incident details and memory are available. Work from what you have; call `request_context` if you need operator input.';
        }

        return `\n\n## Available Integrations (prefer the right tool for each question)\n${lines.join('\n')}\n\n**Cross-referencing rule:** AWS tells you *what* is broken; integrations tell you *why* (deploys, decisions, tickets, customer reports). If an AWS finding is unexpected, reach for the matching integration before concluding.`;
    }

    /**
     * Resolve skill allowedTools names to actual ToolDefinition objects.
     * Falls back to all available investigation tools if a tool name is not found.
     */
    private resolveSkillTools(allowedToolNames: string[]): ToolDefinition[] {
        // Collect all known tools from existing agent configs + dynamic tools
        const allTools = new Map<string, ToolDefinition>();
        for (const cfg of Object.values(AGENT_CONFIG_MAP)) {
            for (const tool of cfg.tools) {
                allTools.set(tool.name, tool);
            }
        }
        // Also register AWS_API_CALL_TOOL since it's no longer in static configs
        allTools.set(AWS_API_CALL_TOOL.name, AWS_API_CALL_TOOL);
        return allowedToolNames
            .map(name => allTools.get(name))
            .filter((t): t is ToolDefinition => t !== undefined);
    }
    async execute(input: InvestigationInput): Promise<InvestigationResult | void> {
        const { tenantId, incidentId, suggestedAgents } = input;
        // 1. Validate incident exists and is in triaging status
        const incident = await this.incidentRepo.findById(tenantId, incidentId);
        if (!incident) {
            throw new NotFoundError('Incident', incidentId);
        }
        if (incident.status !== 'triaging' && incident.status !== 'investigating') {
            throw new IncidentNotInvestigatableError(incidentId, incident.status);
        }
        if (isLocalLlmFailClosedMode()) {
            try {
                await assertLocalLlmReachable(this.circuitBreaker);
            } catch (err) {
                throw new InvestigationFailedError(
                    String(incidentId),
                    err instanceof Error ? err.message : LOCAL_LLM_UNAVAILABLE_MESSAGE,
                );
            }
        }
        // AC-057: attach stub-upstream probe evidence when the tenant has a connection.
        if (this.persistStubUpstreamEvidence) {
            try {
                await this.persistStubUpstreamEvidence(tenantId, incidentId);
            } catch (err) {
                logger.warn(
                    { err, incidentId, tenantId },
                    'Failed to persist stub-upstream probe evidence — non-critical',
                );
            }
        }
        // 2. Pre-investigation memory check — use reflect() to check for known solutions
        input.channel?.sendProgress({ stage: 'memory_check', message: 'Checking knowledge from past incidents...' });
        // Skip if the operator has provided a correction (the description will contain [CORRECTION])
        const hasOperatorCorrection = incident.description.includes('[CORRECTION]');
        if (this.agentMemory && !hasOperatorCorrection) {
            try {
                const reflectPrompt = `Is this a known incident with a proven resolution? ` +
                    `Incident: "${incident.title}". Description: "${incident.description}". ` +
                    `If you have seen this exact pattern before with high confidence and a proven fix, ` +
                    `respond with JSON: {"known": true, "rootCause": "...", "fix": "...", "confidence": 0.0-1.0}. ` +
                    `If not certain enough, respond: {"known": false}`;
                const knownSolutionCheck = await this.agentMemory.reflect(tenantId, reflectPrompt, { budget: 'mid', tags: ['investigation', 'remediation'] });
                const reflectTcId = await this.logSyntheticMemoryCall({
                    tenantId, incidentId,
                    name: 'memory_reflect',
                    input: { prompt: reflectPrompt, budget: 'mid', tags: ['investigation', 'remediation'] },
                    output: knownSolutionCheck ?? '',
                    label: 'Known solution check',
                });
                if (knownSolutionCheck) {
                    const jsonMatch = knownSolutionCheck.match(/\{[\s\S]*"known"\s*:\s*true[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]) as { known?: boolean; rootCause?: string; confidence?: number; fix?: string };
                        if (parsed.known && parsed.rootCause && (parsed.confidence ?? 0) >= 0.85) {
                            // Cross-validate: recall supporting memories to confirm the reflect() claim
                            const MIN_SUPPORTING_MEMORIES = 2;
                            const supportingQuery = `${incident.title} ${parsed.rootCause}`;
                            const supportingMemories = await this.agentMemory.recall(tenantId, supportingQuery,
                                { maxResults: 5, tags: ['investigation'], budget: 'low' },
                            );
                            await this.logSyntheticMemoryCall({
                                tenantId, incidentId,
                                name: 'memory_recall',
                                input: { query: supportingQuery, maxResults: 5, tags: ['investigation'], budget: 'low' },
                                output: supportingMemories.length > 0
                                    ? supportingMemories.map((m, i) => `${i + 1}. [${m.type}] ${m.text}`).join('\n')
                                    : '',
                                label: 'Supporting memories (cross-validation)',
                            });
                            if (supportingMemories.length < MIN_SUPPORTING_MEMORIES) {
                                logger.info({ incidentId, confidence: parsed.confidence, memoriesFound: supportingMemories.length, required: MIN_SUPPORTING_MEMORIES },
                                    'Known solution claim not backed by enough memories — proceeding with full investigation');
                                input.channel?.sendProgress({ stage: 'memory_check', message: `Memory suggested a known solution but only ${supportingMemories.length} supporting memory found — investigating to confirm...` });
                            } else {
                            logger.info({ incidentId, confidence: parsed.confidence, supportingMemories: supportingMemories.length }, 'Known solution found via memory — skipping investigation');
                            const knownClaim = `Known solution: ${parsed.rootCause}`;
                            // Link the known-solution evidence to the memory_reflect tool call
                            // it was derived from. Quote is a literal substring of that output.
                            const knownQuote = knownSolutionCheck && knownSolutionCheck.length > 0
                                ? knownSolutionCheck.slice(0, Math.min(500, knownSolutionCheck.length))
                                : '';
                            const knownSolutionContent = `Known solution identified from memory.\n\n**Root Cause:** ${parsed.rootCause}\n**Fix:** ${parsed.fix ?? 'N/A'}\n**Self-reported confidence:** ${Math.round((parsed.confidence ?? 0) * 100)}%\n**Supporting memories:** ${supportingMemories.length}`;
                            const knownSolutionEvId = evidenceId(`known-solution-${incidentId}`);
                            await this.evidenceRepo.create({
                                tenantId, incidentId,
                                evidenceId: knownSolutionEvId,
                                agentRole: 'orchestrator',
                                evidenceType: 'historical_context',
                                content: knownSolutionContent,
                                toolCallId: reflectTcId ? toToolCallId(reflectTcId) : undefined,
                                claim: knownClaim,
                                quote: knownQuote || undefined,
                                metadata: { label: 'Known Solution (Memory)', confidence: parsed.confidence, source: 'memory' },
                                createdAt: new Date().toISOString(),
                            });
                            input.channel?.sendEvidence({
                                evidenceId: knownSolutionEvId as string,
                                agentRole: 'orchestrator',
                                evidenceType: 'historical_context',
                                content: knownSolutionContent,
                                metadata: {
                                    label: 'Known Solution (Memory)',
                                    memoriesFound: supportingMemories.length,
                                    memoryConfidence: parsed.confidence,
                                    skippedInvestigation: true,
                                    toolCallId: reflectTcId,
                                    toolName: 'memory_reflect',
                                    claim: knownClaim,
                                    quote: knownQuote,
                                },
                            });
                            const knownActions: StructuredAction[] = parsed.fix ? [{
                                action: parsed.fix,
                                label: parsed.fix.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                                description: `Known fix: ${parsed.rootCause ?? 'unknown'}`,
                                rationale: `Previously resolved with ${Math.round((parsed.confidence ?? 0) * 100)}% confidence`,
                                riskLevel: 'medium',
                                estimatedDuration: '~5 min',
                                automated: false,
                                params: {},
                            }] : [];
                            await this.incidentRepo.update(tenantId, incidentId, {
                                knownSolutionStatus: 'pending',
                                rootCause: parsed.rootCause,
                                recommendedActions: knownActions,
                                updatedAt: new Date().toISOString(),
                            });
                            const knownStatus = knownActions.length > 0 ? 'awaiting_approval' : 'resolved';
                            await this.incidentRepo.updateStatus(tenantId, incidentId, knownStatus);
                            await this.eventBus.publish({
                                eventType: 'investigation.known_solution_found',
                                occurredAt: new Date().toISOString(),
                                tenantId,
                                payload: { incidentId, confidence: parsed.confidence, rootCause: parsed.rootCause },
                            });
                            return {
                                findings: [{
                                    text: `Known solution found via memory with ${Math.round((parsed.confidence ?? 0) * 100)}% confidence`,
                                    evidenceIds: [knownSolutionEvId as string],
                                }],
                                potentialRootCause: parsed.rootCause,
                                recommendedActions: knownActions,
                                evidence: [],
                            };
                            } // end else (enough supporting memories)
                        }
                    }
                }
            }
            catch { /* non-critical — proceed with full investigation */ }
        }
        // 3. Transition to investigating
        const investigationStartMs = Date.now();
        await this.incidentRepo.updateStatus(tenantId, incidentId, 'investigating');
        // 3b. Orchestrator mode: single agent with all tools
        if (config.enhancedRunner.orchestratorMode) {
            try {
                return await this.executeOrchestrator(input, incident, investigationStartMs);
            } catch (err) {
                if (this.isCircuitBreakerFailure(err)) {
                    throw new InvestigationFailedError(
                        String(incidentId),
                        err instanceof Error ? err.message : 'Circuit breaker is open',
                    );
                }
                this.failIfCircuitBreakerOpen(incidentId);
                this.failClosedIfLocalLlmMode(incidentId);
                logger.warn({ err, incidentId, tenantId }, 'Orchestrator execution failed — producing stub result');
                // Fallback: produce stub result so pipeline continues (AC-019)
                const stubRootCause = 'Unable to determine root cause (LLM service unavailable)';
                await this.incidentRepo.update(tenantId, incidentId, {
                    rootCause: stubRootCause,
                    investigationDurationMs: Date.now() - investigationStartMs,
                    updatedAt: new Date().toISOString(),
                });
                await this.incidentRepo.updateStatus(tenantId, incidentId, 'resolved');
                await this.eventBus.publish({
                    eventType: 'investigation.completed',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: { incidentId, rootCause: stubRootCause, recommendedActions: [], totalCostUsd: 0, investigationDurationMs: Date.now() - investigationStartMs },
                });
                const stubRoles = suggestedAgents.filter((r) => r in AGENT_CONFIG_MAP);
                const agentRoles = stubRoles.length > 0 ? stubRoles : ['log_analyst', 'metric_analyst', 'change_detector', 'code_analyzer', 'infra_inspector', 'db_analyst'];
                for (const role of agentRoles) {
                    await this.eventBus.publish({
                        eventType: 'investigation.progress',
                        occurredAt: new Date().toISOString(),
                        tenantId,
                        payload: {
                            incidentId,
                            stage: 'agent_completed',
                            agentRole: role,
                            message: `Agent ${role} completed (stub — LLM unavailable)`,
                        },
                    });
                }
                await this.persistInvestigationArtifacts({
                    tenantId,
                    incidentId,
                    agentRoles,
                    rootCause: stubRootCause,
                });
                if (this.agentMemory) {
                    retainInvestigationSummary(
                        this.agentMemory, tenantId, incidentId, incident.title,
                        stubRootCause,
                        [{ text: 'Investigation completed without agent findings (LLM unavailable)' }],
                        [],
                        0,
                        Date.now() - investigationStartMs,
                        agentRoles,
                    ).catch(() => { /* non-critical */ });
                }
                return {
                    findings: [{ text: 'Investigation completed without agent findings (LLM unavailable)', evidenceIds: [] }],
                    potentialRootCause: stubRootCause,
                    recommendedActions: [],
                    evidence: [],
                };
            }
        }
        // 4. Dispatch sub-agents in parallel
        // Enrich agent prompts with Hindsight memory (investigations, remediations, topology, integrations)
        let memoryContext = '';
        if (this.agentMemory) {
            try {
                const query = `${incident.title} ${incident.description} ${incident.sourceProvider}`;
                const memories = await this.agentMemory.recall(tenantId, query, {
                    maxResults: 7,
                    budget: 'mid',
                });
                if (memories.length > 0) {
                    memoryContext = '\n\nRelevant Knowledge from Past Incidents & Infrastructure:\n' +
                        memories.map((m, i) => `${i + 1}. [${m.type}] ${m.text}`).join('\n');
                }
                // Persist orchestrator recall payload so AC-052 can observe prior runbooks
                // via tool_calls (same shape as executeOrchestrator prelude).
                await this.logSyntheticMemoryCall({
                    tenantId, incidentId,
                    name: 'memory_recall',
                    input: { query, maxResults: 7, budget: 'mid' },
                    output: memoryContext || '(no memories found)',
                    label: 'Investigation prelude',
                });
            }
            catch { /* non-critical — degrade gracefully */ }
        }
        // Enrich agent prompts with repo context (from code knowledge mappings)
        const repoContext = '';
        const knownRepos: string[] = [];
        const unknownRoles = suggestedAgents.filter((r) => !(r in AGENT_CONFIG_MAP));
        if (unknownRoles.length > 0) {
            logger.warn({ unknownRoles, incidentId }, 'Unknown agent roles requested - skipping');
        }
        const validRoles = (() => {
            const roles = suggestedAgents.filter((r) => r in AGENT_CONFIG_MAP);
            if (roles.length > 0) return roles;
            // Local-only / LLM-fallback path may enqueue with an empty agent list —
            // default to the six foundational agents so AC-046 still runs the pipeline.
            return ['log_analyst', 'metric_analyst', 'change_detector', 'code_analyzer', 'infra_inspector', 'db_analyst'];
        })();
        // Progress: investigation started (after auto-add so message reflects real agent list)
        await this.eventBus.publish({
            eventType: 'investigation.progress',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId,
                stage: 'started',
                message: `Investigation started with agents: ${validRoles.join(', ')}`,
            },
        });
        // Fetch Composio integration tools and connected apps (if provider is configured)
        let composioTools: ToolDefinition[] = [];
        let connectedComposioApps: string[] = [];
        if (this.integrationToolProvider) {
            try {
                const connections = await this.integrationToolProvider.getConnectionStatus(tenantId);
                connectedComposioApps = connections.filter(c => c.status === 'connected').map(c => c.provider);
                composioTools = connectedComposioApps.length > 0
                    ? await this.integrationToolProvider.getTools(tenantId, connectedComposioApps)
                    : [];
                if (composioTools.length > 0) {
                    logger.info({ incidentId, composioToolCount: composioTools.length, connectedComposioApps }, 'Composio tools loaded for investigation');
                }
            }
            catch (err) {
                logger.warn({ err, incidentId }, 'Failed to load Composio tools — continuing without them');
            }
        }
        // Build tenant capabilities: check AWS via credential vending (avoids double Composio fetch)
        let hasAws = false;
        if (this.credentialVendor) {
            try {
                const testCreds = await this.credentialVendor.vend({
                    tenantId,
                    incidentId,
                    agentRole: 'scout',
                    provider: this.cloudProvider.name,
                    requestedPermissions: [],
                });
                hasAws = testCreds.provider !== 'stub' && !!testCreds.credentials['accessKeyId'];
            } catch {
                hasAws = false;
            }
        }
        const capabilities: TenantCapabilities = {
            hasAws,
            composioApps: connectedComposioApps,
            hasRelay: this.relayGateway?.isConnected(tenantId) ?? false,
        };
        logger.info({ tenantId, capabilities: { hasAws: capabilities.hasAws, composioApps: capabilities.composioApps, hasRelay: capabilities.hasRelay } }, 'Tenant capabilities resolved');

        // Partition agents into waves: Wave 0 (scout) → Wave 1 (foundational) → Wave 2 (specialized)
        const wave1Roles = validRoles.filter((r) => (AGENT_CONFIG_MAP[r]?.wave ?? 2) === 1);
        const wave2Roles = validRoles.filter((r) => (AGENT_CONFIG_MAP[r]?.wave ?? 2) === 2);
        const successfulResults: SubAgentResult[] = [];
        const failedAgents: Array<{ role: string; error: string }> = [];
        // --- WAVE 0: Scout agent (fast context gathering) ---
        let scoutFindings = '';
        if (config.enhancedRunner.scoutAgent) {
            try {
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: { incidentId, stage: 'wave_started', wave: 0, message: 'Wave 0 started: scout' },
                });
                const { successful } = await this.runAgentWave(['scout'], incident, tenantId, incidentId, memoryContext, repoContext, knownRepos, composioTools, capabilities);
                if (successful.length > 0) {
                    successful.forEach((r) => { r.wave = 0; });
                    successfulResults.push(...successful);
                    scoutFindings = `\n\n--- Scout Findings ---\n${successful[0]!.findings.join('\n')}`;
                }
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: { incidentId, stage: 'wave_completed', wave: 0, message: 'Wave 0 completed: scout' },
                });
            } catch (err) {
                logger.warn({ err, incidentId }, 'Scout agent failed — continuing without scout context');
            }
        }
        // Prepend scout findings to memory context for downstream agents
        const enrichedMemoryContext = scoutFindings ? memoryContext + scoutFindings : memoryContext;
        // --- WAVE 1: foundational agents (log_analyst, metric_analyst) ---
        if (wave1Roles.length > 0) {
            await this.eventBus.publish({
                eventType: 'investigation.progress',
                occurredAt: new Date().toISOString(),
                tenantId,
                payload: { incidentId, stage: 'wave_started', wave: 1, message: `Wave 1 started: ${wave1Roles.join(', ')}` },
            });
            const { successful, failed } = await this.runAgentWave(wave1Roles, incident, tenantId, incidentId, enrichedMemoryContext, repoContext, knownRepos, composioTools, capabilities);
            successful.forEach((r) => { r.wave = 1; });
            successfulResults.push(...successful);
            failedAgents.push(...failed);
            await this.eventBus.publish({
                eventType: 'investigation.progress',
                occurredAt: new Date().toISOString(),
                tenantId,
                payload: { incidentId, stage: 'wave_completed', wave: 1, message: `Wave 1 completed: ${successful.length} succeeded, ${failed.length} failed` },
            });
        }
        // --- Skill Selection: add tenant-specific skill agents to Wave 2 ---
        if (config.enhancedRunner.tenantSkills && this.selectSkills) {
            try {
                const wave1Context = formatWaveFindings(successfulResults.filter((r) => r.wave === 1));
                const selectedSkills = await this.selectSkills.execute({
                    tenantId,
                    incidentTitle: incident.title,
                    incidentDescription: incident.description,
                    severity: incident.severity,
                    wave1Findings: wave1Context,
                });
                for (const skill of selectedSkills) {
                    const skillRole = `skill:${skill.name}`;
                    // Register skill as dynamic agent config
                    AGENT_CONFIG_MAP[skillRole] = {
                        agentRole: skillRole as `skill:${string}`,
                        wave: 2,
                        model: skill.model,
                        maxTurns: skill.maxTurns ?? 5,
                        minToolCalls: skill.minToolCalls ?? 2,
                        staticSystemPrompt: skill.systemPrompt,
                        systemPrompt: '',
                        tools: this.resolveSkillTools(skill.allowedTools),
                    };
                    wave2Roles.push(skillRole);
                }
                if (selectedSkills.length > 0) {
                    logger.info({ incidentId, skillCount: selectedSkills.length, skills: selectedSkills.map(s => s.name) }, 'Tenant skills selected for investigation');
                }
            } catch (err) {
                logger.warn({ err, incidentId }, 'Skill selection failed — continuing without tenant skills');
            }
        }
        // --- WAVE 2: specialized agents with Wave 1 context ---
        if (wave2Roles.length > 0) {
            const wave1Context = formatWaveFindings(successfulResults.filter((r) => r.wave === 1));
            await this.eventBus.publish({
                eventType: 'investigation.progress',
                occurredAt: new Date().toISOString(),
                tenantId,
                payload: { incidentId, stage: 'wave_started', wave: 2, message: `Wave 2 started: ${wave2Roles.join(', ')}` },
            });
            const { successful, failed } = await this.runAgentWave(wave2Roles, incident, tenantId, incidentId, enrichedMemoryContext, repoContext, knownRepos, composioTools, capabilities, wave1Context);
            successful.forEach((r) => { r.wave = 2; });
            successfulResults.push(...successful);
            failedAgents.push(...failed);
            await this.eventBus.publish({
                eventType: 'investigation.progress',
                occurredAt: new Date().toISOString(),
                tenantId,
                payload: { incidentId, stage: 'wave_completed', wave: 2, message: `Wave 2 completed: ${successful.length} succeeded, ${failed.length} failed` },
            });
        }
        // 4. If all agents failed, produce stub result so pipeline continues (AC-019)
        if (successfulResults.length === 0) {
            this.failIfCircuitBreakerOpen(incidentId);
            const circuitErr = failedAgents.find((a) => a.error.includes('Circuit breaker is open'));
            if (circuitErr) {
                throw new InvestigationFailedError(String(incidentId), circuitErr.error);
            }
            this.failClosedIfLocalLlmMode(incidentId);
            logger.warn({ incidentId, tenantId, failedAgents }, 'All sub-agents failed — completing with stub result');
            const stubRootCause = 'Unable to determine root cause (LLM service unavailable)';
            const investigationDurationMs = Date.now() - investigationStartMs;
            const stubAgentRoles = failedAgents.length > 0
                ? failedAgents.map((a) => a.role)
                : validRoles;
            for (const role of stubAgentRoles) {
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: {
                        incidentId,
                        stage: 'agent_completed',
                        agentRole: role,
                        message: `Agent ${role} completed (stub — LLM unavailable)`,
                    },
                });
            }
            await this.incidentRepo.update(tenantId, incidentId, {
                rootCause: stubRootCause,
                assignedAgents: stubAgentRoles,
                investigationDurationMs,
                updatedAt: new Date().toISOString(),
            });
            await this.incidentRepo.updateStatus(tenantId, incidentId, 'resolved');
            await this.eventBus.publish({
                eventType: 'investigation.completed',
                occurredAt: new Date().toISOString(),
                tenantId,
                payload: {
                    incidentId,
                    rootCause: stubRootCause,
                    agentsUsed: stubAgentRoles,
                    recommendedActions: [],
                    totalCostUsd: 0,
                    investigationDurationMs,
                },
            });
            await this.persistInvestigationArtifacts({
                tenantId,
                incidentId,
                agentRoles: stubAgentRoles,
                rootCause: stubRootCause,
                agentDetails: stubAgentRoles.map((role) => {
                    const failed = failedAgents.find((a) => a.role === role);
                    return {
                        role,
                        content: failed?.error || `Agent ${role} failed (LLM unavailable)`,
                        confidence: 0,
                    };
                }),
            });
            if (this.agentMemory) {
                retainInvestigationSummary(
                    this.agentMemory, tenantId, incidentId, incident.title,
                    stubRootCause,
                    [{ text: 'Investigation completed without agent findings (LLM unavailable)' }],
                    [],
                    0,
                    investigationDurationMs,
                    stubAgentRoles,
                ).catch(() => { /* non-critical */ });
            }
            return {
                findings: [{ text: 'Investigation completed without agent findings (LLM unavailable)', evidenceIds: [] }],
                potentialRootCause: stubRootCause,
                recommendedActions: [],
                evidence: [],
            };
        }
        // 5. Save evidence per sub-agent
        for (const agentResult of successfulResults) {
            await this.evidenceRepo.create({
                tenantId,
                incidentId,
                evidenceId: evidenceId(uuidv4()),
                agentRole: agentResult.agentRole,
                evidenceType: 'agent_reasoning',
                content: agentResult.findings.join('\n'),
                metadata: { confidence: agentResult.confidence },
                createdAt: new Date().toISOString(),
            });
        }
        // Progress: synthesizing
        await this.eventBus.publish({
            eventType: 'investigation.progress',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId,
                stage: 'synthesizing',
                message: `Synthesizing findings from ${successfulResults.length} agents`,
            },
        });
        // 6. Synthesis: combine all findings via single-shot LLM call
        const findingsSummary = successfulResults
            .map((r) => `[${r.agentRole}]: ${r.findings.join('\n')}`)
            .join('\n\n');
        const synthesisPrompt = `Incident Context:
Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}

IMPORTANT: Each agent section below includes their analysis AND raw tool call results (actual AWS API responses).
Base your root cause analysis on the ACTUAL DATA from tool results, not just the agent's interpretation.
Look for specific numbers, error counts, DLQ depths, service states, and anomalies in the tool outputs.

Agent investigation findings and tool results:

${findingsSummary}`;
        let investigationResult: InvestigationResult;
        let synthesisCostUsd = 0;
        try {
            const completion = await this.llmClient.complete({
                model: this.synthesisModel,
                systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
                userPrompt: synthesisPrompt,
                maxTokens: 4096,
                temperature: 0,
                responseSchema: investigationResultSchema,
            });
            investigationResult = completion.content as InvestigationResult;
            synthesisCostUsd = completion.costUsd;
            await this.persistLlmCompletionEvidence({
                tenantId,
                incidentId,
                model: completion.model,
                phase: 'synthesis',
                agentRole: 'orchestrator',
                content: `Investigation synthesis completed via ${completion.model}`,
            });
        }
        catch (err) {
            if (err instanceof LlmContextTooLargeError) {
                throw new InvestigationFailedError(
                    String(incidentId),
                    `${LLM_CONTEXT_TOO_LARGE_CODE}: ${err.message}`,
                );
            }
            if (isLocalLlmFailClosedMode() || this.isCircuitBreakerFailure(err)) {
                throw new InvestigationFailedError(
                    String(incidentId),
                    err instanceof Error ? err.message : LOCAL_LLM_UNAVAILABLE_MESSAGE,
                );
            }
            // Fallback: build result from agent findings when synthesis JSON parsing fails
            logger.warn({ err, incidentId }, 'Synthesis LLM failed, building result from agent findings');
            const allFindings = successfulResults.flatMap((r) => r.findings);
            investigationResult = {
                findings: stringsToFindings(allFindings),
                potentialRootCause: allFindings[0] ?? 'Unable to synthesize — see individual agent findings',
                recommendedActions: [],
                evidence: allFindings.map((f) => ({ type: 'agent_finding', content: f })),
            };
        }
        // 6b. Verification Agent (Wave 3): adversarial diagnosis challenge
        if (config.enhancedRunner.verificationAgent) {
            try {
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: { incidentId, stage: 'wave_started', wave: 3, message: 'Wave 3 started: diagnosis_verifier' },
                });
                const verificationPrompt = `Diagnosis to verify:\nRoot Cause: "${investigationResult.potentialRootCause}"\n\nFindings:\n${investigationResult.findings.slice(0, 5).map((f) => f.text).join('\n')}\n\nEvidence:\n${JSON.stringify(investigationResult.evidence?.slice(0, 5) ?? [])}`;
                const { successful: verifyResults } = await this.runAgentWave(
                    ['diagnosis_verifier'], incident, tenantId, incidentId, enrichedMemoryContext, repoContext, knownRepos, composioTools, capabilities, verificationPrompt,
                );
                if (verifyResults.length > 0) {
                    const verifyResult = verifyResults[0]!;
                    verifyResult.wave = 3;
                    successfulResults.push(verifyResult);
                    investigationResult.findings.push({ text: `[Verification] ${verifyResult.findings.join('; ')}`, evidenceIds: [] });
                    await this.evidenceRepo.create({
                        tenantId,
                        incidentId,
                        evidenceId: evidenceId(uuidv4()),
                        agentRole: 'diagnosis_verifier' as const,
                        evidenceType: 'agent_reasoning',
                        content: verifyResult.findings.join('\n'),
                        metadata: { source: 'verification_agent', confidence: verifyResult.confidence },
                        createdAt: new Date().toISOString(),
                    });
                }
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: { incidentId, stage: 'wave_completed', wave: 3, message: 'Wave 3 completed: diagnosis_verifier' },
                });
            } catch (err) {
                logger.warn({ err, incidentId }, 'Verification agent failed — continuing without verification');
            }
        }
        // Fallback: Hindsight memory falsification (when verification agent is disabled)
        else if (this.agentMemory) {
            try {
                const challenge = await this.agentMemory.reflect(tenantId, `Challenge this root cause diagnosis with maximum skepticism:\n` +
                    `Root Cause: "${investigationResult.potentialRootCause}"\n` +
                    `Findings: ${investigationResult.findings.slice(0, 3).map((f) => f.text).join('; ')}\n\n` +
                    `Based on past incidents for this tenant: Is this plausible? ` +
                    `What evidence contradicts this? Are there alternative explanations? ` +
                    `Have similar diagnoses been wrong before?`, { budget: 'high', tags: ['investigation', 'remediation', 'feedback'] });
                if (challenge && challenge.length > 50) {
                    investigationResult.findings.push({ text: `[Falsification Check] ${challenge}`, evidenceIds: [] });
                    await this.evidenceRepo.create({
                        tenantId,
                        incidentId,
                        evidenceId: evidenceId(uuidv4()),
                        agentRole: 'falsifier',
                        evidenceType: 'agent_reasoning',
                        content: challenge,
                        metadata: { source: 'hindsight_falsification' },
                        createdAt: new Date().toISOString(),
                    });
                }
            }
            catch { /* non-critical — investigation proceeds without falsification */ }
        }
        // 7. Save synthesis evidence
        await this.evidenceRepo.create({
            tenantId,
            incidentId,
            evidenceId: evidenceId(uuidv4()),
            agentRole: 'coordinator',
            evidenceType: 'agent_reasoning',
            content: investigationResult.potentialRootCause,
            metadata: { source: 'synthesis' },
            createdAt: new Date().toISOString(),
        });
        await this.persistHypothesisTree({
            tenantId,
            incidentId,
            rootCause: investigationResult.potentialRootCause,
            agentResults: successfulResults,
        });
        // 8. Calculate costs, duration, and update incident
        const wave0CostUsd = successfulResults.filter((r) => r.wave === 0).reduce((sum, r) => sum + r.costUsd, 0);
        const wave1CostUsd = successfulResults.filter((r) => r.wave === 1).reduce((sum, r) => sum + r.costUsd, 0);
        const wave2CostUsd = successfulResults.filter((r) => r.wave === 2).reduce((sum, r) => sum + r.costUsd, 0);
        const wave3CostUsd = successfulResults.filter((r) => r.wave === 3).reduce((sum, r) => sum + r.costUsd, 0);
        const subAgentCostUsd = wave0CostUsd + wave1CostUsd + wave2CostUsd + wave3CostUsd;
        const totalCostUsd = subAgentCostUsd + synthesisCostUsd;
        const costBreakdown = { subAgents: subAgentCostUsd, synthesis: synthesisCostUsd, codeFixer: 0, wave0: wave0CostUsd, wave1: wave1CostUsd, wave2: wave2CostUsd, wave3: wave3CostUsd };
        const investigationDurationMs = Date.now() - investigationStartMs;
        await this.incidentRepo.update(tenantId, incidentId, {
            rootCause: investigationResult.potentialRootCause,
            recommendedActions: investigationResult.recommendedActions,
            assignedAgents: successfulResults.map((r) => r.agentRole),
            customerExplanation: investigationResult.customerExplanation,
            totalCostUsd,
            costBreakdown,
            investigationDurationMs,
            updatedAt: new Date().toISOString(),
        });
        // 8b. Retain investigation summary + tool strategies in Hindsight
        if (this.agentMemory) {
            retainInvestigationSummary(
                this.agentMemory, tenantId, incidentId, incident.title,
                investigationResult.potentialRootCause, investigationResult.findings,
                investigationResult.recommendedActions, totalCostUsd,
                investigationDurationMs, successfulResults.map(r => r.agentRole),
            ).catch(() => { /* non-critical */ });
        }
        // 9. Check cost ceiling (AC-038). If the total cost exceeds the configured
        //    per-investigation ceiling, abort the run and mark cost_exceeded.
        const ceiling = config.billing.maxCostUsd;
        if (ceiling > 0 && totalCostUsd > ceiling) {
            logger.warn(
                { incidentId, totalCostUsd, ceiling },
                'Investigation cost exceeded ceiling — aborting',
            );
            await this.incidentRepo.updateStatus(tenantId, incidentId, 'cost_exceeded');
            return { ...investigationResult, failedAgents: failedAgents.length > 0 ? failedAgents : undefined };
        }

        // 9b. Update incident status — awaiting_approval if remediation proposed, resolved otherwise
        const nextStatus = investigationResult.recommendedActions.length > 0 ? 'awaiting_approval' : 'resolved';
        await this.incidentRepo.updateStatus(tenantId, incidentId, nextStatus);

        // 10. Publish investigation.completed event
        logger.info({
            incidentId, totalCostUsd, investigationDurationMs,
            subAgentCostUsd, synthesisCostUsd,
            agentsUsed: successfulResults.map((r) => r.agentRole),
        }, 'Investigation completed');
        await this.eventBus.publish({
            eventType: 'investigation.completed',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId,
                rootCause: investigationResult.potentialRootCause,
                agentsUsed: successfulResults.map((r) => r.agentRole),
                recommendedActions: investigationResult.recommendedActions,
                proposedFix: investigationResult.proposedFix,
                totalCostUsd,
                costBreakdown,
                agentBreakdown: successfulResults.map((r) => ({
                    agentRole: r.agentRole,
                    inputTokens: r.usage.inputTokens,
                    outputTokens: r.usage.outputTokens,
                    costUsd: r.costUsd,
                })),
                investigationDurationMs,
            },
        });
        // 10. If auto-remediable actions exist, enqueue for remediation
        if (this.messageQueue && this.remediationQueueUrl && investigationResult.recommendedActions.length > 0) {
            await this.messageQueue.send(this.remediationQueueUrl, {
                incidentId,
                tenantId,
                rootCause: investigationResult.potentialRootCause,
                recommendedActions: investigationResult.recommendedActions,
            });
        }
        return { ...investigationResult, failedAgents: failedAgents.length > 0 ? failedAgents : undefined };
    }
    private async executeOrchestrator(
        input: InvestigationInput,
        incident: Incident,
        investigationStartMs: number,
    ): Promise<InvestigationResult | void> {
        const { tenantId, incidentId } = input;

        // Per-run tool call tracker (shared by memory prelude + agent run + cite_evidence).
        const tracker = new ToolCallTracker();

        // 1. Build memory context
        let memoryContext = '';
        if (this.agentMemory) {
            try {
                const query = `${incident.title} ${incident.description} ${incident.sourceProvider}`;
                const memories = await this.agentMemory.recall(tenantId, query, { maxResults: 7, budget: 'mid' });
                if (memories.length > 0) {
                    memoryContext = '\n\nRelevant Knowledge from Past Incidents & Infrastructure:\n' +
                        memories.map((m, i) => `${i + 1}. [${m.type}] ${m.text}`).join('\n');
                }
                await this.logSyntheticMemoryCall({
                    tenantId, incidentId,
                    name: 'memory_recall',
                    input: { query, maxResults: 7, budget: 'mid' },
                    output: memoryContext || '(no memories found)',
                    label: 'Investigation prelude',
                    tracker,
                });
            } catch { /* non-critical */ }
        }

        // 2. Build repo context
        const repoContext = '';
        const knownRepos: string[] = [];

        // 3. Build tenant capabilities + Composio tools
        let composioTools: ToolDefinition[] = [];
        let connectedComposioApps: string[] = [];
        if (this.integrationToolProvider) {
            try {
                const connections = await this.integrationToolProvider.getConnectionStatus(tenantId);
                connectedComposioApps = connections.filter(c => c.status === 'connected').map(c => c.provider);
                composioTools = connectedComposioApps.length > 0
                    ? await this.integrationToolProvider.getTools(tenantId, connectedComposioApps)
                    : [];
            } catch (err) {
                logger.warn({ err, incidentId }, 'Failed to load Composio tools — continuing without them');
            }
        }

        input.channel?.sendProgress({ stage: 'capability_check', message: 'Detecting AWS, integrations, and relay capabilities...' });
        let hasAws = false;
        if (this.credentialVendor) {
            try {
                const testCreds = await this.credentialVendor.vend({
                    tenantId, incidentId, agentRole: 'orchestrator',
                    provider: this.cloudProvider.name, requestedPermissions: [],
                });
                hasAws = testCreds.provider !== 'stub' && !!testCreds.credentials['accessKeyId'];
            } catch (err) {
                logger.warn({ err: err instanceof Error ? err.message : err, tenantId, incidentId }, 'AWS credential vend failed during capability check');
                hasAws = false;
            }
        }
        const capabilities: TenantCapabilities = {
            hasAws,
            composioApps: connectedComposioApps,
            hasRelay: this.relayGateway?.isConnected(tenantId) ?? false,
        };
        logger.info({ tenantId, incidentId, hasAws, composioApps: connectedComposioApps.length, hasRelay: capabilities.hasRelay }, 'Capability check result');
        // Broadcast capabilities to frontend for transparency
        const capParts: string[] = [];
        if (hasAws) capParts.push('AWS');
        const uniqueApps = [...new Set(connectedComposioApps)];
        if (uniqueApps.length > 0) {
            const appNames = uniqueApps.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ');
            capParts.push(`Integrations (${appNames})`);
        }
        capParts.push('Memory');
        if (capabilities.hasRelay) capParts.push('Live Relay');
        input.channel?.sendProgress({
            stage: 'capabilities_ready',
            message: JSON.stringify({ capabilities: capParts, composioApps: connectedComposioApps, hasAws, hasRelay: capabilities.hasRelay, toolCount: composioTools.length }),
        });

        // 4. Vend credentials
        let cloudCredentials;
        if (this.credentialVendor) {
            try {
                cloudCredentials = await this.credentialVendor.vend({
                    tenantId, incidentId, agentRole: 'orchestrator',
                    provider: this.cloudProvider.name, requestedPermissions: [],
                });
            } catch (vendErr) {
                logger.warn({ tenantId, err: vendErr instanceof Error ? vendErr.message : String(vendErr) }, 'Credential vend failed — using stub');
                cloudCredentials = { provider: 'stub', credentials: {}, region: this.defaultRegion };
            }
        } else {
            cloudCredentials = { provider: 'stub', credentials: {}, region: this.defaultRegion };
        }

        // 5. Create base tool handler
        const rawToolHandler = this.toolHandlerFactory({
            cloudProvider: this.cloudProvider, cloudCredentials,
            incidentRepo: this.incidentRepo, tenantId, incidentId,
            agentMemory: this.agentMemory, knownRepos,
            relayGateway: this.relayGateway, integrationToolProvider: this.integrationToolProvider,
        });

        // 6. Assemble tools
        const mergedTools = this.buildToolsForAgent(ORCHESTRATOR_CONFIG, capabilities, composioTools);
        const capabilitiesPrompt = this.buildCapabilitiesPrompt(capabilities, connectedComposioApps);
        const enrichedStaticPrompt = ORCHESTRATOR_CONFIG.staticSystemPrompt
            ? ORCHESTRATOR_CONFIG.staticSystemPrompt + capabilitiesPrompt
            : undefined;

        // 7. Build user prompt
        const serviceInfo = incident.sourceProvider && incident.sourceProvider !== 'chat' && incident.sourceProvider !== 'manual'
            ? `\nService: ${incident.sourceProvider}` : '';
        const userPrompt = `Investigate incident ${incidentId} for tenant ${tenantId}.
Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}${serviceInfo}

Use the incident title and description to identify which services, log groups, and metrics to investigate. Do NOT assume a service name — discover it from the infrastructure.

Analyze and report your findings.${memoryContext}${repoContext}`;

        // 8. Investigation channel: wire guidance + send progress
        const { channel } = input;
        const guidanceMessages: string[] = [];
        if (channel) {
            channel.onGuidance((guidance) => {
                guidanceMessages.push(guidance);
                logger.info({ incidentId, guidance: guidance.slice(0, 100) }, 'User guidance received');
            });
        }

        // 8b. cite_evidence handler — validates citations against the per-run tracker.
        const citeHandler = createCiteEvidenceHandler({
            tracker,
            evidenceRepo: this.evidenceRepo,
            tenantId, incidentId,
            channel,
        });

        // 8c. Create combined tool handler (checkpoint + cite_evidence + investigation tools)
        const { handler: checkpointHandler, cleanup: checkpointCleanup } = createCheckpointToolHandler(channel, incidentId);
        const toolHandler = async (name: string, toolInput: Record<string, unknown>) => {
            const checkpointResult = await checkpointHandler(name, toolInput);
            if (checkpointResult !== null) return checkpointResult;
            const citeResult = await citeHandler(name, toolInput);
            if (citeResult !== null) return citeResult;
            try {
                return await rawToolHandler(name, toolInput);
            } catch (err) {
                // Notify frontend about tool failure
                const errMsg = err instanceof Error ? err.message : String(err);
                channel?.sendProgress({ stage: 'tool_error', message: JSON.stringify({ toolName: name, error: errMsg.slice(0, 300) }) });
                const formatted = await enrichErrorWithMemory(name, err, this.agentMemory, tenantId);
                throw new Error(formatted);
            }
        };

        // Inject guidance into user prompt if any arrived before agent starts
        let enrichedUserPrompt = userPrompt;
        if (guidanceMessages.length > 0) {
            enrichedUserPrompt += '\n\nUser Guidance:\n' + guidanceMessages.map(g => `- ${g}`).join('\n');
        }

        // Progress: started
        await this.eventBus.publish({
            eventType: 'investigation.progress',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: { incidentId, stage: 'orchestrator_started', message: `Orchestrator investigation started with ${mergedTools.length} tools` },
        });
        channel?.sendProgress({ stage: 'orchestrator_started', message: `Investigation started with ${mergedTools.length} tools`, maxTurns: ORCHESTRATOR_CONFIG.maxTurns });

        // 9. Run orchestrator
        logger.info({ incidentId, tenantId, toolCount: mergedTools.length, model: ORCHESTRATOR_CONFIG.model }, 'Orchestrator agent starting');
        const result = await this.agentRunner.run({
            model: ORCHESTRATOR_CONFIG.model,
            systemPrompt: ORCHESTRATOR_CONFIG.systemPrompt,
            staticSystemPrompt: enrichedStaticPrompt,
            userPrompt: enrichedUserPrompt,
            tools: mergedTools,
            toolHandler,
            toolCallTracker: tracker,
            maxTurns: ORCHESTRATOR_CONFIG.maxTurns,
            minToolCalls: ORCHESTRATOR_CONFIG.minToolCalls,
            useCodeExecution: ORCHESTRATOR_CONFIG.useCodeExecution,
            memory: input.memory,
            onToolCall: (toolName, toolInput) => {
                if (channel?.isConnected()) {
                    channel.sendToolCall({ toolName, input: sanitizeToolInput(toolInput) });
                }
            },
        });
        checkpointCleanup();
        logger.info({ incidentId, tenantId, toolCalls: result.toolCalls.length, costUsd: result.costUsd, turns: result.turns }, 'Orchestrator agent completed');

        // Persist raw tool calls (deterministic audit log — every call with exact input/output).
        // Uses the tracker-assigned id so cited evidence (which references tc_xxx) links correctly.
        const MAX_OUTPUT_BYTES = 100_000;
        let persistedCount = 0;
        for (const tc of result.toolCalls) {
            if (!tc.id) continue; // skipped by adapter (cite_evidence, checkpoint tools)
            const output = tc.output.length > MAX_OUTPUT_BYTES
                ? tc.output.slice(0, MAX_OUTPUT_BYTES) + '\n\n[truncated]'
                : tc.output;
            const isError = tc.output.startsWith('Tool `') || tc.output.length < 20;
            try {
                await this.toolCallRepo.create({
                    tenantId, incidentId,
                    toolCallId: toToolCallId(tc.id),
                    agentRole: 'orchestrator',
                    name: tc.name,
                    origin: 'real',
                    input: tc.input,
                    output,
                    success: !isError,
                    createdAt: new Date().toISOString(),
                });
                persistedCount++;
            } catch (err) {
                logger.warn({ err, incidentId, toolCallId: tc.id, name: tc.name }, 'Failed to persist raw tool call — continuing');
            }
        }
        logger.info({ incidentId, persisted: persistedCount, total: result.toolCalls.length }, 'Raw tool calls persisted');

        // Send checkpoint with key findings via channel
        if (channel && result.response) {
            channel.sendCheckpoint({
                stage: 'orchestrator_completed',
                finding: result.response.slice(0, 500),
                toolCallCount: result.toolCalls.length,
                turn: result.turns,
            });
        }

        // 10. Progress: completed
        const collapsed = collapseToolSummaries(result.toolCalls);
        const timelineSummary = formatCollapsedTimeline(collapsed);
        await this.eventBus.publish({
            eventType: 'investigation.progress',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId, stage: 'orchestrator_completed',
                message: `Orchestrator completed with ${result.toolCalls.length} tool calls in ${result.turns} turns`,
                timeline: timelineSummary || undefined,
            },
        });

        // 11. Save orchestrator evidence
        let orchestratorResult: SubAgentResult = {
            agentRole: 'orchestrator',
            findings: [buildAgentSummary(result.response, result.toolCalls)],
            confidence: calculateConfidence(result),
            toolCallsMade: result.toolCalls.length,
            usage: result.totalUsage,
            model: result.model,
            costUsd: result.costUsd,
            truncatedResults: result.truncatedResults,
            parallelBatches: result.parallelBatches,
            retryCount: result.retryCount,
        };

        // Evidence is created exclusively via `cite_evidence` during the agent run —
        // the classifier-based bulk write was removed. Evidence for this incident now
        // lives in DynamoDB already, populated by the cite_evidence handler.
        channel?.sendProgress({ stage: 'saving_evidence', message: 'Persisting investigation evidence...' });

        // Retain findings in Hindsight
        if (this.agentMemory) {
            retainAgentFindings(
                this.agentMemory, tenantId, incident.title, incidentId,
                orchestratorResult, result.toolCalls,
            ).catch(() => { /* non-critical */ });
        }

        // 12. Pre-synthesis gate: synthesis cannot run with zero evidences (schema requires evidenceIds.min(1)).
        let evidences = await this.evidenceRepo.findByIncident(tenantId, incidentId);

        if (evidences.length === 0) {
            // Telemetry: orchestrator ran tool calls but produced zero cite_evidence calls.
            // Logged here (inside the zero-evidence branch) so we incur no extra DB round-trip.
            if (result.toolCalls.length > 0) {
                logger.warn({
                    event: 'orchestrator_failed_to_cite',
                    incidentId,
                    tenantId,
                    agentRole: 'orchestrator',
                    agentReportedFindings: orchestratorResult.findings.length,
                    toolCalls: result.toolCalls.length,
                    evidences: 0,
                }, 'Orchestrator completed tool calls without calling cite_evidence');
            }

            logger.warn({
                incidentId,
                tenantId,
                agentReportedFindings: orchestratorResult.findings.length,
                toolCalls: result.toolCalls.length,
                event: 'pre_synthesis_zero_evidence',
            }, 'Pre-synthesis gate: 0 evidences after agent run, re-invoking orchestrator');

            // Re-invoke orchestrator with strict continuation prompt — bounded to ONE retry.
            const reinvokeResult = await this.agentRunner.run({
                model: ORCHESTRATOR_CONFIG.model,
                systemPrompt: ORCHESTRATOR_CONFIG.systemPrompt,
                userPrompt: ORCHESTRATOR_REINVOCATION_PROMPT,
                tools: this.buildToolsForAgent(ORCHESTRATOR_CONFIG, { hasAws: false, composioApps: [], hasRelay: false }, []),
                toolHandler: async (name: string, toolInput: Record<string, unknown>) => {
                    const citeHandler = createCiteEvidenceHandler({
                        tracker,
                        evidenceRepo: this.evidenceRepo,
                        tenantId, incidentId,
                        channel,
                    });
                    const citeResult = await citeHandler(name, toolInput);
                    if (citeResult !== null) return citeResult;
                    return `Tool ${name} not available in re-invocation context`;
                },
                toolCallTracker: tracker,
                maxTurns: ORCHESTRATOR_CONFIG.maxTurns,
            });
            orchestratorResult = {
                ...orchestratorResult,
                findings: [buildAgentSummary(reinvokeResult.response, reinvokeResult.toolCalls)],
                costUsd: orchestratorResult.costUsd + reinvokeResult.costUsd,
                toolCallsMade: orchestratorResult.toolCallsMade + reinvokeResult.toolCalls.length,
            };
            evidences = await this.evidenceRepo.findByIncident(tenantId, incidentId);

            if (evidences.length === 0) {
                // Terminal: agent could not cite evidence even after re-invocation. Mark inconclusive; do NOT call synthesis.
                return await this.terminateInconclusive({
                    tenantId,
                    incidentId,
                    reason: 'agent_failed_to_cite_evidence_after_reinvocation',
                    costAccrued: orchestratorResult.costUsd,
                    channel,
                });
            }

            // Re-invocation succeeded — log for cite-rate monitoring.
            logger.info({
                event: 'orchestrator_reinvocation_succeeded',
                incidentId,
                tenantId,
                agentRole: 'orchestrator',
                evidencesAfterReinvocation: evidences.length,
            }, 'Orchestrator re-invocation produced evidence; proceeding to synthesis');
        }

        // 12b. Synthesis
        channel?.sendProgress({ stage: 'synthesizing', message: 'Synthesizing findings into root cause analysis...' });
        await this.eventBus.publish({
            eventType: 'investigation.progress',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: { incidentId, stage: 'synthesizing', message: 'Synthesizing orchestrator findings' },
        });

        const baseSynthesisPrompt = `Incident Context:
Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}

IMPORTANT: The investigation below was conducted by a single SRE orchestrator agent with full access to all tools.
The findings include actual AWS API responses, log data, and infrastructure state.
Base your root cause analysis on the ACTUAL DATA from tool results.

Investigation findings and tool results:

${buildAgentSummary(result.response, result.toolCalls)}`;

        let investigationResult: InvestigationResult;
        let synthesisCostUsd = 0;
        try {
            const synth = await this.synthesizeWithValidation({
                tenantId, incidentId,
                baseSynthesisPrompt,
            });
            investigationResult = synth.result;
            synthesisCostUsd = synth.costUsd;
        } catch (err) {
            // Synthesis exhausted all retries with invalid citations despite evidence being available.
            // Route to inconclusive — do NOT fabricate unvalidated findings.
            logger.warn({ err, incidentId }, 'Synthesis exhausted all citation retries — terminating as inconclusive');
            return await this.terminateInconclusive({
                tenantId,
                incidentId,
                reason: 'synthesis_exhausted_with_invalid_citations',
                costAccrued: orchestratorResult.costUsd,
                channel,
            });
        }

        // 13. Optional verification agent
        const successfulResults: SubAgentResult[] = [orchestratorResult];
        if (config.enhancedRunner.verificationAgent) {
            try {
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: { incidentId, stage: 'wave_started', wave: 3, message: 'Verification started: diagnosis_verifier' },
                });
                const verificationPrompt = `Diagnosis to verify:\nRoot Cause: "${investigationResult.potentialRootCause}"\n\nFindings:\n${investigationResult.findings.slice(0, 5).map((f) => f.text).join('\n')}\n\nEvidence:\n${JSON.stringify(investigationResult.evidence?.slice(0, 5) ?? [])}`;
                const { successful: verifyResults } = await this.runAgentWave(
                    ['diagnosis_verifier'], incident, tenantId, incidentId, memoryContext, repoContext, knownRepos, composioTools, capabilities, verificationPrompt,
                );
                if (verifyResults.length > 0) {
                    const verifyResult = verifyResults[0]!;
                    verifyResult.wave = 3;
                    successfulResults.push(verifyResult);
                    investigationResult.findings.push({ text: `[Verification] ${verifyResult.findings.join('; ')}`, evidenceIds: [] });
                    const verifyEvidenceId = evidenceId(uuidv4());
                    await this.evidenceRepo.create({
                        tenantId, incidentId,
                        evidenceId: verifyEvidenceId,
                        agentRole: 'diagnosis_verifier',
                        evidenceType: 'agent_reasoning',
                        content: verifyResult.findings.join('\n'),
                        metadata: { source: 'verification_agent', confidence: verifyResult.confidence },
                        createdAt: new Date().toISOString(),
                    });
                    channel?.sendEvidence({
                        evidenceId: verifyEvidenceId as string,
                        agentRole: 'diagnosis_verifier',
                        evidenceType: 'agent_reasoning',
                        content: verifyResult.findings.join('\n').slice(0, 2000),
                        metadata: { source: 'verification_agent', confidence: verifyResult.confidence },
                    });
                }
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: { incidentId, stage: 'wave_completed', wave: 3, message: 'Verification completed: diagnosis_verifier' },
                });
            } catch (err) {
                logger.warn({ err, incidentId }, 'Verification agent failed — continuing without verification');
            }
        } else if (this.agentMemory) {
            try {
                const challenge = await this.agentMemory.reflect(tenantId,
                    `Challenge this root cause diagnosis with maximum skepticism:\n` +
                    `Root Cause: "${investigationResult.potentialRootCause}"\n` +
                    `Findings: ${investigationResult.findings.slice(0, 3).map((f) => f.text).join('; ')}\n\n` +
                    `Based on past incidents for this tenant: Is this plausible? ` +
                    `What evidence contradicts this? Are there alternative explanations?`,
                    { budget: 'high', tags: ['investigation', 'remediation', 'feedback'] });
                if (challenge && challenge.length > 50) {
                    investigationResult.findings.push({ text: `[Falsification Check] ${challenge}`, evidenceIds: [] });
                }
            } catch { /* non-critical */ }
        }


        // 15. Save synthesis evidence
        const synthesisEvidenceId = evidenceId(uuidv4());
        await this.evidenceRepo.create({
            tenantId, incidentId,
            evidenceId: synthesisEvidenceId,
            agentRole: 'coordinator',
            evidenceType: 'agent_reasoning',
            content: investigationResult.potentialRootCause,
            metadata: { source: 'synthesis' },
            createdAt: new Date().toISOString(),
        });
        channel?.sendEvidence({
            evidenceId: synthesisEvidenceId as string,
            agentRole: 'coordinator',
            evidenceType: 'agent_reasoning',
            content: (investigationResult.potentialRootCause ?? '').slice(0, 2000),
            metadata: { source: 'synthesis' },
        });

        // 16. Calculate costs + update incident
        const verificationCostUsd = successfulResults.filter((r) => r.wave === 3).reduce((sum, r) => sum + r.costUsd, 0);
        const totalCostUsd = orchestratorResult.costUsd + synthesisCostUsd + verificationCostUsd;
        const costBreakdown = {
            orchestrator: orchestratorResult.costUsd,
            synthesis: synthesisCostUsd,
            codeFixer: 0,
            verification: verificationCostUsd,
        };
        const investigationDurationMs = Date.now() - investigationStartMs;

        await this.incidentRepo.update(tenantId, incidentId, {
            rootCause: investigationResult.potentialRootCause,
            recommendedActions: investigationResult.recommendedActions,
            assignedAgents: successfulResults.map((r) => r.agentRole),
            customerExplanation: investigationResult.customerExplanation,
            totalCostUsd,
            costBreakdown,
            investigationDurationMs,
            updatedAt: new Date().toISOString(),
        });

        // Retain investigation summary in Hindsight
        if (this.agentMemory) {
            retainInvestigationSummary(
                this.agentMemory, tenantId, incidentId, incident.title,
                investigationResult.potentialRootCause, investigationResult.findings,
                investigationResult.recommendedActions, totalCostUsd,
                investigationDurationMs, successfulResults.map(r => r.agentRole),
            ).catch(() => { /* non-critical */ });
        }

        // 17. Check cost ceiling (AC-038). If the total cost exceeds the configured
        //    per-investigation ceiling, abort the run and mark cost_exceeded.
        const ceiling = config.billing.maxCostUsd;
        if (ceiling > 0 && totalCostUsd > ceiling) {
            logger.warn(
                { incidentId, totalCostUsd, ceiling },
                'Orchestrator investigation cost exceeded ceiling — aborting',
            );
            await this.incidentRepo.updateStatus(tenantId, incidentId, 'cost_exceeded');
            return { ...investigationResult, failedAgents: undefined };
        }

        // 18. Update status + publish completion
        const nextStatus = investigationResult.recommendedActions.length > 0 ? 'awaiting_approval' : 'resolved';
        await this.incidentRepo.updateStatus(tenantId, incidentId, nextStatus);

        logger.info({
            incidentId, totalCostUsd, investigationDurationMs,
            orchestratorCostUsd: orchestratorResult.costUsd, synthesisCostUsd,
            toolCalls: result.toolCalls.length, turns: result.turns,
        }, 'Orchestrator investigation completed');

        await this.eventBus.publish({
            eventType: 'investigation.completed',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: {
                incidentId,
                rootCause: investigationResult.potentialRootCause,
                agentsUsed: successfulResults.map((r) => r.agentRole),
                recommendedActions: investigationResult.recommendedActions,
                proposedFix: investigationResult.proposedFix,
                totalCostUsd,
                costBreakdown,
                agentBreakdown: successfulResults.map((r) => ({
                    agentRole: r.agentRole,
                    inputTokens: r.usage.inputTokens,
                    outputTokens: r.usage.outputTokens,
                    costUsd: r.costUsd,
                })),
                investigationDurationMs,
            },
        });

        if (this.messageQueue && this.remediationQueueUrl && investigationResult.recommendedActions.length > 0) {
            await this.messageQueue.send(this.remediationQueueUrl, {
                incidentId, tenantId,
                rootCause: investigationResult.potentialRootCause,
                recommendedActions: investigationResult.recommendedActions,
            });
        }

        return { ...investigationResult, failedAgents: undefined };
    }

    private async terminateInconclusive(params: {
        tenantId: TenantId;
        incidentId: IncidentId;
        reason: string;
        costAccrued: number;
        channel?: IInvestigationChannel;
    }): Promise<void> {
        logger.warn({
            incidentId: params.incidentId,
            tenantId: params.tenantId,
            reason: params.reason,
            costAccrued: params.costAccrued,
        }, 'Investigation marked inconclusive — agent failed to cite evidence after re-invocation');

        await this.incidentRepo.update(params.tenantId, params.incidentId, {
            status: 'inconclusive',
            resolution: `inconclusive: ${params.reason}`,
            totalCostUsd: params.costAccrued,
        });

        await this.eventBus.publish({
            eventType: 'investigation.inconclusive',
            occurredAt: new Date().toISOString(),
            tenantId: params.tenantId,
            payload: { incidentId: params.incidentId, reason: params.reason },
        });

        params.channel?.sendProgress({
            stage: 'inconclusive',
            message: 'Investigation completed without sufficient evidence. Marked inconclusive.',
        });
    }

    async runAgentWave(roles: string[], incident: Incident, tenantId: TenantId, incidentId: IncidentId, memoryContext: string, repoContext: string, knownRepos: string[], composioTools: ToolDefinition[], capabilities: TenantCapabilities, priorFindings?: string): Promise<{ successful: SubAgentResult[]; failed: Array<{ role: string; error: string }> }> {
        const allToolCalls = new Map<string, ToolCallRecord[]>();
        const agentPromises = roles.map(async (role: string) => {
            const agentConfig = AGENT_CONFIG_MAP[role] as SubAgentConfig;
            let cloudCredentials;
            if (this.credentialVendor) {
                try {
                    cloudCredentials = await this.credentialVendor.vend({
                        tenantId,
                        incidentId,
                        agentRole: agentConfig.agentRole,
                        provider: this.cloudProvider.name,
                        requestedPermissions: [],
                    });
                    logger.info({ role, tenantId, provider: cloudCredentials.provider, region: cloudCredentials.region }, 'Credentials vended for sub-agent');
                } catch (vendErr) {
                    logger.warn({ role, tenantId, err: vendErr instanceof Error ? vendErr.message : String(vendErr) }, 'Credential vend failed — using stub credentials');
                    cloudCredentials = { provider: 'stub', credentials: {}, region: this.defaultRegion };
                }
            }
            else {
                cloudCredentials = { provider: 'stub', credentials: {}, region: this.defaultRegion };
            }
            const rawToolHandler = this.toolHandlerFactory({
                cloudProvider: this.cloudProvider,
                cloudCredentials,
                incidentRepo: this.incidentRepo,
                tenantId,
                incidentId,
                agentMemory: this.agentMemory,
                knownRepos,
                relayGateway: this.relayGateway,
                integrationToolProvider: this.integrationToolProvider,
            });
            // Wrap with enhanced error formatting (Insight 4)
            const toolHandler = async (name: string, input: Record<string, unknown>) => {
                try {
                    return await rawToolHandler(name, input);
                } catch (err) {
                    // Format errors for LLM consumption + enrich with Hindsight context
                    const formatted = await enrichErrorWithMemory(name, err, this.agentMemory, tenantId);
                    throw new Error(formatted);
                }
            };
            const serviceInfo = incident.sourceProvider && incident.sourceProvider !== 'chat' && incident.sourceProvider !== 'manual'
                ? `\nService: ${incident.sourceProvider}` : '';
            const userPrompt = `Investigate incident ${incidentId} for tenant ${tenantId}.
Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}${serviceInfo}

Use the incident title and description to identify which services, log groups, and metrics to investigate. Do NOT assume a service name — discover it from the infrastructure.

Analyze and report your findings.${memoryContext}${repoContext}${priorFindings ?? ''}`;
            // Dynamic tool assembly based on tenant capabilities
            const mergedTools = this.buildToolsForAgent(agentConfig, capabilities, composioTools);

            // Inject capabilities section into the static system prompt
            const capabilitiesPrompt = this.buildCapabilitiesPrompt(capabilities, capabilities.composioApps);
            const enrichedStaticPrompt = agentConfig.staticSystemPrompt
                ? agentConfig.staticSystemPrompt + capabilitiesPrompt
                : undefined;

            logger.info({ role, incidentId, tenantId, toolCount: mergedTools.length, model: agentConfig.model, hasAws: capabilities.hasAws, composioApps: capabilities.composioApps.length }, 'Sub-agent starting');
            const result = await this.agentRunner.run({
                model: agentConfig.model,
                systemPrompt: agentConfig.systemPrompt,
                staticSystemPrompt: enrichedStaticPrompt,
                userPrompt,
                tools: mergedTools,
                toolHandler,
                maxTurns: agentConfig.maxTurns,
                minToolCalls: agentConfig.minToolCalls,
                useCodeExecution: agentConfig.useCodeExecution,
            });
            logger.info({ role, incidentId, tenantId, toolCalls: result.toolCalls.length, costUsd: result.costUsd }, 'Sub-agent completed');
            // Store tool calls for retention and timeline
            allToolCalls.set(role, result.toolCalls);
            return {
                agentRole: agentConfig.agentRole,
                findings: [buildAgentSummary(result.response, result.toolCalls)],
                confidence: calculateConfidence(result),
                toolCallsMade: result.toolCalls.length,
                usage: result.totalUsage,
                model: result.model,
                costUsd: result.costUsd,
                truncatedResults: result.truncatedResults,
                parallelBatches: result.parallelBatches,
                retryCount: result.retryCount,
            };
        });
        const settledResults = await Promise.allSettled(agentPromises);
        const successful: SubAgentResult[] = [];
        const failed: Array<{ role: string; error: string }> = [];
        for (let idx = 0; idx < settledResults.length; idx++) {
            const result = settledResults[idx]!;
            if (result.status === 'fulfilled') {
                successful.push(result.value);
                // Collapsed timeline for progress event
                const agentToolCalls = result.value.toolCallsMade;
                const collapsed = collapseToolSummaries(
                    allToolCalls.get(roles[idx]!) ?? [],
                );
                const timelineSummary = formatCollapsedTimeline(collapsed);
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: {
                        incidentId,
                        stage: 'agent_completed',
                        agentRole: result.value.agentRole,
                        message: `Agent ${result.value.agentRole} completed with ${agentToolCalls} tool calls`,
                        timeline: timelineSummary || undefined,
                    },
                });
                // Retain findings in Hindsight for future investigations
                if (this.agentMemory) {
                    retainAgentFindings(
                        this.agentMemory, tenantId, incident.title, incidentId,
                        result.value, allToolCalls.get(roles[idx]!) ?? [],
                    ).catch(() => { /* non-critical */ });
                }
            }
            else {
                const role = roles[idx]!;
                const rawReason: unknown = result.reason as unknown;
                const error = rawReason instanceof Error ? rawReason.message : (typeof rawReason === 'string' ? rawReason : 'Unknown error');
                const stack = rawReason instanceof Error ? rawReason.stack?.split('\n').slice(0, 3).join('\n') : undefined;
                logger.error({ role, error, stack, incidentId, tenantId }, 'Sub-agent failed during investigation');
                this.circuitBreaker?.onFailure();
                failed.push({ role, error });
                await this.eventBus.publish({
                    eventType: 'investigation.progress',
                    occurredAt: new Date().toISOString(),
                    tenantId,
                    payload: {
                        incidentId,
                        stage: 'agent_failed',
                        agentRole: role,
                        message: `Agent ${role} failed: ${error}`,
                    },
                });
            }
        }
        return { successful, failed };
    }
}
