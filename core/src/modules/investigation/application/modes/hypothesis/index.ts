import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../../../shared/infra/logger.js';
import { NotFoundError } from '../../../../../shared/domain/errors.js';
import { IncidentNotInvestigatableError } from '../../../domain/investigation.errors.js';
import { evidenceId } from '../../../../../shared/domain/value-objects.js';
import { Seeker } from '../shared/seeker.js';
import { Recon } from '../shared/recon.js';
import { resolveSeekerModel } from '../shared/tenant-maturity.js';
import { Judge } from './judge.js';
import { VALIDATOR_SYSTEM_PROMPT } from './prompts.js';
import type {
  InvestigationInput,
  InvestigationResult,
  StructuredAction,
} from '../../../domain/investigation.types.js';
import type { InvestigationMode } from '../types.js';
import type { IHypothesisRepository } from '../../../domain/hypothesis.repository.js';
import type { IIncidentRepository } from '../../../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../../../../triage/domain/evidence.repository.js';
import type { IEventBus } from '../../../../../shared/domain/events.js';
import type {
  AgentRunner,
  ToolCallRecord,
  ToolDefinition,
} from '../../../../../shared/application/ports/agent-runner.port.js';
import type { TenantId, IncidentId } from '../../../../../shared/domain/value-objects.js';
import type { LLMClient } from '../../../../../shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../../../shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../../../shared/application/ports/credential-vendor.port.js';
import type { IntegrationToolProvider } from '../../../../../shared/application/ports/integration-tool-provider.port.js';
import type { IRelayGateway } from '../../../../../shared/application/ports/relay-gateway.port.js';
import type { AgentMemory } from '../../../../../shared/application/ports/agent-memory.port.js';
import type { ToolHandlerFactory } from '../../investigate-incident.usecase.js';
import type { IInvestigationToolset } from '../shared/toolset.port.js';
import type { MetricRecorder } from '../../../../../shared/application/ports/metric-recorder.port.js';
import { config } from '../../../../../shared/config/index.js';

export interface HypothesisModeDeps {
  toolset: IInvestigationToolset;
  hypothesisRepo: IHypothesisRepository;
  incidentRepo: IIncidentRepository;
  evidenceRepo: IEvidenceRepository;
  eventBus: IEventBus;
  agentRunner: AgentRunner;
  llmClient: LLMClient;
  cloudProvider: CloudProvider;
  credentialVendor?: CredentialVendor;
  toolHandlerFactory: ToolHandlerFactory;
  integrationToolProvider?: IntegrationToolProvider;
  relayGateway?: IRelayGateway;
  agentMemory?: AgentMemory;
  /** Default seeker model for tenants with a healthy incident history. */
  seekerModel?: string;
  /** Seeker model bumped for cold-start tenants (no memory signal). */
  seekerColdStartModel?: string;
  /** Optional model override for the pre-seeker reconnaissance agent. */
  reconModel?: string;
  /** Skip reconnaissance entirely (defaults to false — run when capabilities available). */
  disableRecon?: boolean;
  /** Model for the validator agent. Sonnet recommended — tool-use heavy. */
  validatorModel?: string;
  /** Model for the final judge LLM. Sonnet recommended — structured output. */
  judgeModel?: string;
  /** Max turns for the validator agent. Default 15. */
  validatorMaxTurns?: number;
  /** Minimum tool calls before validator can conclude. Default 6. */
  validatorMinToolCalls?: number;
  /** Disable the re-seek fallback (defaults to enabled). */
  disableReseek?: boolean;
  /** Score below which the judge's ruling is considered "exhausted". Default 50. */
  reseekThreshold?: number;
  /** Optional Langfuse/Cloudwatch metrics sink — tagged `mode: hypothesis`. */
  metrics?: MetricRecorder;
}

const MODE_TAG = { mode: 'hypothesis' };

const DEFAULT_VALIDATOR_MAX_TURNS = 15;
const DEFAULT_VALIDATOR_MIN_TOOL_CALLS = 6;
const DEFAULT_RESEEK_THRESHOLD = 50;

/**
 * Hypothesis-driven investigation mode.
 *
 * Three phases:
 *   1. SEEKER    — cheap LLM call that generates 3 mutually distinct root-cause
 *                  hypotheses with priors. Persisted as Hypothesis entities.
 *   2. VALIDATOR — tool-using agent that gathers evidence for/against each
 *                  hypothesis. Prompt instructs it to state which hypothesis
 *                  every tool call is testing.
 *   3. JUDGE     — structured-output LLM call that scores each hypothesis,
 *                  declares a winner, and produces the final InvestigationResult.
 *
 * All three phases persist evidence / hypothesis updates so the UI can replay
 * the reasoning trail.
 */
export class HypothesisMode implements InvestigationMode {
  readonly name = 'hypothesis' as const;
  readonly label = 'Hypothesis-Driven';
  readonly description =
    'Generates 3 hypotheses, validates each with targeted evidence, judge picks the winner.';

  constructor(private readonly deps: HypothesisModeDeps) {}

  async run(input: InvestigationInput): Promise<InvestigationResult> {
    const { tenantId, incidentId, channel } = input;

    // 1. Fetch + validate
    const incident = await this.deps.incidentRepo.findById(tenantId, incidentId);
    if (!incident) throw new NotFoundError('Incident', incidentId);
    if (incident.status !== 'triaging') {
      throw new IncidentNotInvestigatableError(incidentId, incident.status);
    }

    // 2. Capabilities + tools
    const capabilities = await this.deps.toolset.buildCapabilities(tenantId);
    const composioTools: ToolDefinition[] = this.deps.integrationToolProvider
      ? await this.deps.integrationToolProvider.getTools(tenantId)
      : [];
    const mergedTools = this.deps.toolset.buildOrchestratorTools(capabilities, composioTools);
    const capabilitiesPrompt = this.deps.toolset.buildCapabilitiesPrompt(
      capabilities,
      capabilities.composioApps,
    );

    // 3. Credentials for tool handler
    const cloudCredentials = this.deps.credentialVendor
      ? await this.deps.credentialVendor.vend({
          tenantId,
          incidentId,
          agentRole: 'orchestrator',
          provider: this.deps.cloudProvider.name,
          requestedPermissions: [],
        })
      : { provider: 'stub', credentials: {}, region: 'sa-east-1' };

    const toolHandler = this.deps.toolHandlerFactory({
      cloudProvider: this.deps.cloudProvider,
      cloudCredentials,
      incidentRepo: this.deps.incidentRepo,
      tenantId,
      incidentId,
      agentMemory: this.deps.agentMemory,
      relayGateway: this.deps.relayGateway,
      integrationToolProvider: this.deps.integrationToolProvider,
    });

    // ── Phase 0: RECON (opportunistic) ─────────────────────────────
    // Runs only when the tenant has at least one live signal source.
    // Gathers 3-5 targeted observations (recent deploys, error spike,
    // infra state, past incidents) that inform the seeker's priors.
    // Zero-integration tenants skip this entirely and rely on catalog
    // + LLM priors inside the seeker.
    const reconAvailable = capabilities.hasAws || capabilities.composioApps.length > 0;
    let reconSummary: string | undefined;
    let reconCostUsd = 0;
    if (!this.deps.disableRecon && reconAvailable) {
      this.deps.metrics?.increment('investigation.recon_fired', 1, {
        ...MODE_TAG,
        hasAws: String(capabilities.hasAws),
        composioCount: String(capabilities.composioApps.length),
      });
      channel?.sendProgress({ stage: 'recon', message: 'Gathering recent signals…' });
      const recon = new Recon({ agentRunner: this.deps.agentRunner, model: this.deps.reconModel });
      const reconResult = await recon.run({
        incident,
        tools: mergedTools,
        toolHandler,
        capabilitiesPrompt,
        onToolCall: (toolName, toolInput) => {
          if (channel?.isConnected()) {
            channel.sendToolCall({ toolName, input: toolInput });
          }
        },
      });
      if (!reconResult.empty) {
        reconSummary = reconResult.summary;
      }
      reconCostUsd = reconResult.run.costUsd;
      this.deps.metrics?.histogram('investigation.recon_cost_usd', reconCostUsd, MODE_TAG);
    }

    // ── Phase 1: SEEKER ────────────────────────────────────────────
    channel?.sendProgress({ stage: 'hypothesize', message: 'Generating candidate hypotheses…' });
    await this.deps.eventBus.publish({
      eventType: 'investigation.progress',
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: { incidentId, stage: 'hypothesize', message: 'Seeker generating hypotheses' },
    });

    const seekerModel =
      this.deps.seekerColdStartModel && this.deps.seekerModel
        ? await resolveSeekerModel(this.deps.incidentRepo, tenantId, {
            matureModel: this.deps.seekerModel,
            coldStartModel: this.deps.seekerColdStartModel,
          })
        : this.deps.seekerModel;
    const seeker = new Seeker({
      llmClient: this.deps.llmClient,
      hypothesisRepo: this.deps.hypothesisRepo,
      model: seekerModel,
    });
    const seekerResult = await seeker.run(incident, reconSummary);
    const hypotheses = seekerResult.hypotheses;

    logger.info(
      { incidentId, hypothesesCount: hypotheses.length, costUsd: seekerResult.costUsd },
      'Seeker phase complete',
    );
    channel?.sendCheckpoint({
      stage: 'hypothesize',
      finding: hypotheses
        .map((h, i) => `H${i + 1} (prior ${(h.confidence * 100).toFixed(0)}%): ${h.statement}`)
        .join('\n'),
      toolCallCount: 0,
      turn: 0,
    });

    // ── Phase 2: VALIDATOR ─────────────────────────────────────────
    channel?.sendProgress({
      stage: 'validate',
      message: `Validating ${hypotheses.length} hypotheses with tool calls…`,
    });
    await this.deps.eventBus.publish({
      eventType: 'investigation.progress',
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: {
        incidentId,
        stage: 'validate',
        message: `Validator gathering evidence for ${hypotheses.length} hypotheses`,
      },
    });

    const validatorUserPrompt = `Incident:
Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}

## Hypotheses to test

${hypotheses
  .map(
    (
      h,
      i,
    ) => `H${i + 1} (id=${h.hypothesisId}, prior=${(h.confidence * 100).toFixed(0)}%): ${h.statement}
   Rationale: ${h.rationale ?? '—'}`,
  )
  .join('\n\n')}

Gather evidence for/against each hypothesis. For every tool call, state in ONE sentence which hypothesis it is testing and what outcome supports/contradicts it. End with a summary listing, per hypothesis, the strongest supporting and contradicting evidence found.`;

    const validatorRun = await this.deps.agentRunner.run({
      model: this.deps.validatorModel,
      systemPrompt: VALIDATOR_SYSTEM_PROMPT + capabilitiesPrompt,
      userPrompt: validatorUserPrompt,
      tools: mergedTools,
      toolHandler,
      maxTurns: this.deps.validatorMaxTurns ?? DEFAULT_VALIDATOR_MAX_TURNS,
      minToolCalls: this.deps.validatorMinToolCalls ?? DEFAULT_VALIDATOR_MIN_TOOL_CALLS,
      memory: input.memory,
      onToolCall: (toolName, toolInput) => {
        if (channel?.isConnected()) {
          channel.sendToolCall({ toolName, input: toolInput });
        }
      },
    });

    logger.info(
      {
        incidentId,
        toolCalls: validatorRun.toolCalls.length,
        turns: validatorRun.turns,
        costUsd: validatorRun.costUsd,
      },
      'Validator phase complete',
    );

    // Persist validator tool calls as evidence (mirrors orchestrator so UI
    // parity is preserved).
    await this.persistValidatorEvidence(
      incident.tenantId,
      incident.incidentId,
      validatorRun.toolCalls,
      validatorRun.response,
    );

    // ── Phase 3: JUDGE ─────────────────────────────────────────────
    channel?.sendProgress({ stage: 'judge', message: 'Scoring hypotheses and selecting winner…' });
    await this.deps.eventBus.publish({
      eventType: 'investigation.progress',
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: { incidentId, stage: 'judge', message: 'Judge scoring hypotheses' },
    });

    const judge = new Judge({ llmClient: this.deps.llmClient, model: this.deps.judgeModel });
    const firstJudgeResult = await judge.run({
      incident,
      hypotheses,
      validatorSummary: validatorRun.response,
      validatorToolCalls: validatorRun.toolCalls,
    });

    // ── Optional Phase 4: RE-SEEK (hypotheses exhausted) ────────────
    // When every initial hypothesis scored below threshold, the seeker's
    // priors were likely wrong — but the validator DID gather real
    // observations. Regenerate 2 new hypotheses informed by those
    // observations and re-judge. Limited to 1 iteration to cap cost.
    const reseekThreshold = this.deps.reseekThreshold ?? DEFAULT_RESEEK_THRESHOLD;
    const allExhausted = firstJudgeResult.output.rulings.every(
      (r) => r.finalScore < reseekThreshold,
    );
    let hypothesesForPersist = hypotheses;
    let judgeResult = firstJudgeResult;
    let reseekCostUsd = 0;
    let reseekJudgeCostUsd = 0;
    if (allExhausted && !this.deps.disableReseek) {
      this.deps.metrics?.increment('investigation.reseek_triggered', 1, MODE_TAG);
      channel?.sendProgress({
        stage: 'reseek',
        message: `All hypotheses scored below ${reseekThreshold} — regenerating from observations…`,
      });
      await this.deps.eventBus.publish({
        eventType: 'investigation.hypotheses_exhausted',
        occurredAt: new Date().toISOString(),
        tenantId,
        payload: {
          incidentId,
          rejectedHypothesisIds: hypotheses.map((h) => h.hypothesisId),
          highestScore: Math.max(...firstJudgeResult.output.rulings.map((r) => r.finalScore)),
        },
      });
      const rejectedInfo = hypotheses.map((h) => {
        const ruling = firstJudgeResult.output.rulings.find(
          (r) => r.hypothesisId === h.hypothesisId,
        );
        return { statement: h.statement, rejectedReason: ruling?.rejectedReason };
      });
      const observationsBlock = `Validator summary:
${validatorRun.response}

Tool calls (${validatorRun.toolCalls.length} total):
${validatorRun.toolCalls
  .map(
    (c, i) =>
      `${i + 1}. ${c.name}(${JSON.stringify(c.input).slice(0, 120)}) → ${(c.output ?? '').slice(0, 300)}`,
  )
  .join('\n')}`;
      const reseekResult = await seeker.reseek({
        incident,
        rejectedHypotheses: rejectedInfo,
        observations: observationsBlock,
      });
      reseekCostUsd = reseekResult.costUsd;
      const combinedHypotheses = [...hypotheses, ...reseekResult.hypotheses];
      const reJudgeResult = await judge.run({
        incident,
        hypotheses: combinedHypotheses,
        validatorSummary: validatorRun.response,
        validatorToolCalls: validatorRun.toolCalls,
      });
      reseekJudgeCostUsd = reJudgeResult.costUsd;
      const reseekTop = Math.max(...reJudgeResult.output.rulings.map((r) => r.finalScore));
      const originalTop = Math.max(...firstJudgeResult.output.rulings.map((r) => r.finalScore));
      if (reseekTop > originalTop) {
        logger.info(
          { incidentId, originalTop, reseekTop },
          'Re-seek produced a stronger ruling — using it',
        );
        hypothesesForPersist = combinedHypotheses;
        judgeResult = reJudgeResult;
        this.deps.metrics?.increment('investigation.reseek_improved', 1, MODE_TAG);
      } else {
        logger.info(
          { incidentId, originalTop, reseekTop },
          'Re-seek did not beat original ruling — keeping original',
        );
      }
    }

    const ruling = judgeResult.output;

    // Apply rulings back onto each hypothesis.
    const hypothesesById = new Map(hypothesesForPersist.map((h) => [h.hypothesisId, h]));
    for (const r of ruling.rulings) {
      const h = hypothesesById.get(r.hypothesisId);
      if (!h) {
        logger.warn(
          { unknownHypothesisId: r.hypothesisId, incidentId },
          'Judge referenced unknown hypothesis id — skipping update',
        );
        continue;
      }
      await this.deps.hypothesisRepo.update(tenantId, incidentId, r.hypothesisId, {
        confidence: r.confidence,
        finalScore: r.finalScore,
        status: r.status,
        rejectedReason: r.rejectedReason,
        evidenceFor: r.evidenceFor.map((e) => ({
          evidenceId: uuidv4(),
          sourcedBy: 'judge',
          summary: e.summary,
          weight: e.weight,
          toolName: e.toolName,
          observedAt: new Date().toISOString(),
        })),
        evidenceAgainst: r.evidenceAgainst.map((e) => ({
          evidenceId: uuidv4(),
          sourcedBy: 'judge',
          summary: e.summary,
          weight: e.weight,
          toolName: e.toolName,
          observedAt: new Date().toISOString(),
        })),
      });
    }

    // Build the return value.
    const result: InvestigationResult = {
      findings: ruling.findings.map((t: string) => ({ text: t, evidenceIds: [] })),
      potentialRootCause: ruling.potentialRootCause,
      recommendedActions: ruling.recommendedActions as StructuredAction[],
      evidence: ruling.evidence,
      customerExplanation: ruling.customerExplanation,
    };

    // Persist on the Incident + emit completion event.
    const newStatus = result.recommendedActions.length > 0 ? 'awaiting_approval' : 'resolved';
    const totalCostUsd =
      reconCostUsd +
      seekerResult.costUsd +
      validatorRun.costUsd +
      firstJudgeResult.costUsd +
      reseekCostUsd +
      reseekJudgeCostUsd;
    await this.deps.incidentRepo.update(tenantId, incidentId, {
      rootCause: result.potentialRootCause,
      recommendedActions: result.recommendedActions,
      customerExplanation: result.customerExplanation,
      totalCostUsd,
      costBreakdown: {
        orchestrator: validatorRun.costUsd,
        synthesis: judgeResult.costUsd + seekerResult.costUsd,
        codeFixer: 0,
      },
      updatedAt: new Date().toISOString(),
    });
    // Check cost ceiling (AC-038). If the total cost exceeds the configured
    // per-investigation ceiling, abort the run and mark cost_exceeded.
    const ceiling = config.billing.maxCostUsd;
    if (ceiling > 0 && totalCostUsd > ceiling) {
      logger.warn(
        { incidentId, totalCostUsd, ceiling },
        'Hypothesis investigation cost exceeded ceiling — aborting',
      );
      await this.deps.incidentRepo.updateStatus(tenantId, incidentId, 'cost_exceeded');
      return result;
    }

    await this.deps.incidentRepo.updateStatus(tenantId, incidentId, newStatus);

    await this.deps.eventBus.publish({
      eventType: 'investigation.completed',
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: {
        incidentId,
        mode: this.name,
        rootCause: result.potentialRootCause,
        recommendedActions: result.recommendedActions,
        customerExplanation: result.customerExplanation,
        winnerHypothesisId: ruling.winnerHypothesisId,
        costUsd: totalCostUsd,
      },
    });

    // Post-run metrics — emitted after persistence so Langfuse has a
    // consistent view even if the caller retries the request.
    this.deps.metrics?.histogram('investigation.total_cost_usd', totalCostUsd, MODE_TAG);
    this.deps.metrics?.gauge(
      'investigation.hypotheses_count',
      hypothesesForPersist.length,
      MODE_TAG,
    );
    const winnerRuling = ruling.rulings.find((r) => r.status === 'confirmed');
    if (winnerRuling) {
      this.deps.metrics?.histogram('investigation.winner_score', winnerRuling.finalScore, MODE_TAG);
    }

    channel?.sendCheckpoint({
      stage: 'judge',
      finding: `Winner: ${ruling.potentialRootCause}`,
      toolCallCount: validatorRun.toolCalls.length,
      turn: validatorRun.turns,
    });

    return result;
  }

  private async persistValidatorEvidence(
    tenantId: TenantId,
    incidentId: IncidentId,
    toolCalls: ToolCallRecord[],
    agentResponse: string,
  ): Promise<void> {
    // Save the validator's summary as agent_reasoning evidence.
    await this.deps.evidenceRepo.create({
      tenantId,
      incidentId,
      evidenceId: evidenceId(uuidv4()),
      agentRole: 'orchestrator',
      evidenceType: 'agent_reasoning',
      content: agentResponse,
      metadata: { label: 'Hypothesis validator summary' },
      createdAt: new Date().toISOString(),
    });
    // Minimal pass on tool calls — just retain raw content so the UI can
    // surface it. Full classification (log_snippet vs. metric_snapshot)
    // is performed by the orchestrator path; for Phase 2 we keep it simple
    // and tag everything as agent_reasoning with the tool name in label.
    for (const call of toolCalls) {
      await this.deps.evidenceRepo.create({
        tenantId,
        incidentId,
        evidenceId: evidenceId(uuidv4()),
        agentRole: 'orchestrator',
        evidenceType: 'agent_reasoning',
        content: (call.output ?? '').slice(0, 5000),
        metadata: { toolName: call.name, label: `Tool: ${call.name}` },
        createdAt: new Date().toISOString(),
      });
    }
  }
}
