import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../../../shared/infra/logger.js';
import { NotFoundError } from '../../../../../shared/domain/errors.js';
import { IncidentNotInvestigatableError } from '../../../domain/investigation.errors.js';
import { evidenceId } from '../../../../../shared/domain/value-objects.js';
import type { TenantId, IncidentId } from '../../../../../shared/domain/value-objects.js';
import { Seeker } from '../shared/seeker.js';
import { Recon } from '../shared/recon.js';
import { resolveSeekerModel } from '../shared/tenant-maturity.js';
import { Advocate } from './advocate.js';
import { Prosecutor } from './prosecutor.js';
import { DebateJudge } from './judge.js';
import type { DebateRound } from './judge.js';
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
  AgentRunResult,
  ToolDefinition,
} from '../../../../../shared/application/ports/agent-runner.port.js';
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

export interface DebateModeDeps {
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
  seekerModel?: string;
  seekerColdStartModel?: string;
  reconModel?: string;
  disableRecon?: boolean;
  advocateModel?: string;
  prosecutorModel?: string;
  judgeModel?: string;
  advocateMaxTurns?: number;
  prosecutorMaxTurns?: number;
  /** Disable the re-seek fallback when all hypotheses are refuted. Default false. */
  disableReseek?: boolean;
  /** Score below which the judge's ruling is considered "exhausted". Default 50. */
  reseekThreshold?: number;
  /** Optional Langfuse/Cloudwatch metrics sink — tagged `mode: debate`. */
  metrics?: MetricRecorder;
}

const MODE_TAG = { mode: 'debate' };
const DEFAULT_RESEEK_THRESHOLD = 50;
const RESEEK_ADVOCATE_MAX_TURNS = 5;
const RESEEK_PROSECUTOR_MAX_TURNS = 4;

/**
 * Multi-agent debate investigation mode.
 *
 * Four phases:
 *   1. SEEKER        — cheap LLM generates 3 distinct hypotheses (shared with
 *                      hypothesis-driven mode).
 *   2. ADVOCATES     — one tool-using agent per hypothesis runs in parallel,
 *                      each trying to find evidence that confirms its
 *                      assigned hypothesis.
 *   3. PROSECUTORS   — one tool-using agent per hypothesis runs in parallel
 *                      AFTER advocates, each trying to refute its assigned
 *                      hypothesis armed with the advocate's summary.
 *   4. JUDGE         — structured-output LLM reads every transcript and
 *                      scores each hypothesis, picks a winner, produces
 *                      the final InvestigationResult.
 *
 * Cost: ~2-3× orchestrator mode (6 tool-using runs vs. 1). Gain: honest
 * adversarial pressure on every candidate + natural audit trail.
 */
export class DebateMode implements InvestigationMode {
  readonly name = 'debate' as const;
  readonly label = 'Multi-Agent Debate';
  readonly description =
    'Advocate + prosecutor per hypothesis run in parallel, judge picks the winner.';

  constructor(private readonly deps: DebateModeDeps) {}

  async run(input: InvestigationInput): Promise<InvestigationResult> {
    const { tenantId, incidentId, channel } = input;

    // 1. Fetch + validate
    const incident = await this.deps.incidentRepo.findById(tenantId, incidentId);
    if (!incident) throw new NotFoundError('Incident', incidentId);
    if (incident.status !== 'triaging') {
      throw new IncidentNotInvestigatableError(incidentId, incident.status);
    }

    // 2. Capabilities + tools (shared across all 6 agent runs).
    const capabilities = await this.deps.toolset.buildCapabilities(tenantId);
    const composioTools: ToolDefinition[] = this.deps.integrationToolProvider
      ? await this.deps.integrationToolProvider.getTools(tenantId)
      : [];
    const mergedTools = this.deps.toolset.buildOrchestratorTools(capabilities, composioTools);
    const capabilitiesPrompt = this.deps.toolset.buildCapabilitiesPrompt(
      capabilities,
      capabilities.composioApps,
    );

    // 3. Credentials + tool handler (shared — each agent sees the same
    // tenant credentials and same relay gateway).
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
    await this.emitProgress(
      tenantId,
      incidentId,
      'hypothesize',
      'Generating candidate hypotheses…',
    );
    channel?.sendProgress({ stage: 'hypothesize', message: 'Generating candidate hypotheses…' });

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

    channel?.sendCheckpoint({
      stage: 'hypothesize',
      finding: hypotheses
        .map((h, i) => `H${i + 1} (prior ${(h.confidence * 100).toFixed(0)}%): ${h.statement}`)
        .join('\n'),
      toolCallCount: 0,
      turn: 0,
    });

    // ── Phase 2: ADVOCATES (parallel) ───────────────────────────────
    await this.emitProgress(
      tenantId,
      incidentId,
      'advocate',
      `Running ${hypotheses.length} advocate agents in parallel…`,
    );
    channel?.sendProgress({
      stage: 'advocate',
      message: `Running ${hypotheses.length} advocate agents…`,
    });

    const advocate = new Advocate({
      agentRunner: this.deps.agentRunner,
      model: this.deps.advocateModel,
    });
    const advocateResults = await Promise.all(
      hypotheses.map((hypothesis) =>
        advocate.run({
          incident,
          hypothesis,
          tools: mergedTools,
          toolHandler,
          capabilitiesPrompt,
          maxTurns: this.deps.advocateMaxTurns,
          memory: {
            thread: {
              id: `investigation-${incidentId}-advocate-${hypothesis.hypothesisId}`,
              metadata: { incidentId, role: 'advocate', hypothesisId: hypothesis.hypothesisId },
            },
            resource: tenantId,
          },
          onToolCall: (toolName, toolInput) => {
            if (channel?.isConnected()) {
              channel.sendToolCall({
                toolName,
                input: { ...toolInput, __advocateHypothesis: hypothesis.hypothesisId },
              });
            }
          },
        }),
      ),
    );

    await this.persistAgentEvidence('advocate', tenantId, incidentId, advocateResults);

    // ── Phase 3: PROSECUTORS (parallel, after advocates) ────────────
    await this.emitProgress(
      tenantId,
      incidentId,
      'prosecute',
      `Running ${hypotheses.length} prosecutor agents in parallel…`,
    );
    channel?.sendProgress({
      stage: 'prosecute',
      message: `Running ${hypotheses.length} prosecutor agents…`,
    });

    const prosecutor = new Prosecutor({
      agentRunner: this.deps.agentRunner,
      model: this.deps.prosecutorModel,
    });
    const prosecutorResults = await Promise.all(
      hypotheses.map((hypothesis, i) =>
        prosecutor.run({
          incident,
          hypothesis,
          advocateSummary: advocateResults[i]!.run.response,
          tools: mergedTools,
          toolHandler,
          capabilitiesPrompt,
          maxTurns: this.deps.prosecutorMaxTurns,
          memory: {
            thread: {
              id: `investigation-${incidentId}-prosecutor-${hypothesis.hypothesisId}`,
              metadata: { incidentId, role: 'prosecutor', hypothesisId: hypothesis.hypothesisId },
            },
            resource: tenantId,
          },
          onToolCall: (toolName, toolInput) => {
            if (channel?.isConnected()) {
              channel.sendToolCall({
                toolName,
                input: { ...toolInput, __prosecutorHypothesis: hypothesis.hypothesisId },
              });
            }
          },
        }),
      ),
    );

    await this.persistAgentEvidence('prosecutor', tenantId, incidentId, prosecutorResults);

    // ── Phase 4: JUDGE ──────────────────────────────────────────────
    await this.emitProgress(
      tenantId,
      incidentId,
      'judge',
      'Scoring hypotheses and selecting winner…',
    );
    channel?.sendProgress({ stage: 'judge', message: 'Judge scoring hypotheses…' });

    const rounds: DebateRound[] = hypotheses.map((hypothesis, i) => ({
      hypothesis,
      advocate: advocateResults[i]!.run,
      prosecutor: prosecutorResults[i]!.run,
    }));

    const judge = new DebateJudge({ llmClient: this.deps.llmClient, model: this.deps.judgeModel });
    const firstJudgeResult = await judge.run({ incident, rounds });

    // ── Optional: RE-SEEK (hypotheses exhausted) ────────────────────
    // When every hypothesis scored below threshold, the initial set was
    // wrong but the debate DID gather real observations. Regenerate 2
    // new hypotheses informed by observations, run a mini-debate on
    // them, and re-judge. Limited to 1 iteration.
    const reseekThreshold = this.deps.reseekThreshold ?? DEFAULT_RESEEK_THRESHOLD;
    const allExhausted = firstJudgeResult.output.rulings.every(
      (r) => r.finalScore < reseekThreshold,
    );
    let hypothesesForPersist = hypotheses;
    let judgeResult = firstJudgeResult;
    let reseekCostUsd = 0;
    let reseekJudgeCostUsd = 0;
    let reseekAdvocatesCostUsd = 0;
    let reseekProsecutorsCostUsd = 0;
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
        const r = firstJudgeResult.output.rulings.find((x) => x.hypothesisId === h.hypothesisId);
        return { statement: h.statement, rejectedReason: r?.rejectedReason };
      });
      const observationsBlock = rounds
        .map(
          (round, i) => `### Hypothesis ${i + 1} (refuted)
Advocate summary: ${round.advocate.response}
Prosecutor summary: ${round.prosecutor.response}`,
        )
        .join('\n\n');

      const reseekResult = await seeker.reseek({
        incident,
        rejectedHypotheses: rejectedInfo,
        observations: observationsBlock,
      });
      reseekCostUsd = reseekResult.costUsd;

      // Mini-debate on the new hypotheses — reduced turns to cap cost.
      const miniAdvocateResults = await Promise.all(
        reseekResult.hypotheses.map((h) =>
          advocate.run({
            incident,
            hypothesis: h,
            tools: mergedTools,
            toolHandler,
            capabilitiesPrompt,
            maxTurns: RESEEK_ADVOCATE_MAX_TURNS,
            memory: {
              thread: {
                id: `investigation-${incidentId}-advocate-${h.hypothesisId}`,
                metadata: {
                  incidentId,
                  role: 'advocate',
                  hypothesisId: h.hypothesisId,
                  reseek: true,
                },
              },
              resource: tenantId,
            },
          }),
        ),
      );
      reseekAdvocatesCostUsd = miniAdvocateResults.reduce((s, r) => s + r.run.costUsd, 0);

      const miniProsecutorResults = await Promise.all(
        reseekResult.hypotheses.map((h, i) =>
          prosecutor.run({
            incident,
            hypothesis: h,
            advocateSummary: miniAdvocateResults[i]!.run.response,
            tools: mergedTools,
            toolHandler,
            capabilitiesPrompt,
            maxTurns: RESEEK_PROSECUTOR_MAX_TURNS,
            memory: {
              thread: {
                id: `investigation-${incidentId}-prosecutor-${h.hypothesisId}`,
                metadata: {
                  incidentId,
                  role: 'prosecutor',
                  hypothesisId: h.hypothesisId,
                  reseek: true,
                },
              },
              resource: tenantId,
            },
          }),
        ),
      );
      reseekProsecutorsCostUsd = miniProsecutorResults.reduce((s, r) => s + r.run.costUsd, 0);

      await this.persistAgentEvidence('advocate', tenantId, incidentId, miniAdvocateResults);
      await this.persistAgentEvidence('prosecutor', tenantId, incidentId, miniProsecutorResults);

      const combinedHypotheses = [...hypotheses, ...reseekResult.hypotheses];
      const reseekRounds: DebateRound[] = [
        ...rounds,
        ...reseekResult.hypotheses.map((h, i) => ({
          hypothesis: h,
          advocate: miniAdvocateResults[i]!.run,
          prosecutor: miniProsecutorResults[i]!.run,
        })),
      ];
      const reJudgeResult = await judge.run({ incident, rounds: reseekRounds });
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
          'Re-seek did not beat original — keeping original',
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
          'Judge referenced unknown hypothesis id — skipping',
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
          sourcedBy: 'advocate',
          summary: e.summary,
          weight: e.weight,
          toolName: e.toolName,
          observedAt: new Date().toISOString(),
        })),
        evidenceAgainst: r.evidenceAgainst.map((e) => ({
          evidenceId: uuidv4(),
          sourcedBy: 'prosecutor',
          summary: e.summary,
          weight: e.weight,
          toolName: e.toolName,
          observedAt: new Date().toISOString(),
        })),
      });
    }

    // Final result shape (mirrors InvestigationResult so consumers stay
    // mode-agnostic).
    const result: InvestigationResult = {
      findings: ruling.findings.map((t: string) => ({ text: t, evidenceIds: [] })),
      potentialRootCause: ruling.potentialRootCause,
      recommendedActions: ruling.recommendedActions as StructuredAction[],
      evidence: ruling.evidence,
      customerExplanation: ruling.customerExplanation,
    };

    const totalCostUsd =
      reconCostUsd +
      seekerResult.costUsd +
      advocateResults.reduce((s, r) => s + r.run.costUsd, 0) +
      prosecutorResults.reduce((s, r) => s + r.run.costUsd, 0) +
      firstJudgeResult.costUsd +
      reseekCostUsd +
      reseekAdvocatesCostUsd +
      reseekProsecutorsCostUsd +
      reseekJudgeCostUsd;

    const newStatus = result.recommendedActions.length > 0 ? 'awaiting_approval' : 'resolved';
    await this.deps.incidentRepo.update(tenantId, incidentId, {
      rootCause: result.potentialRootCause,
      recommendedActions: result.recommendedActions,
      customerExplanation: result.customerExplanation,
      totalCostUsd,
      costBreakdown: {
        orchestrator:
          advocateResults.reduce((s, r) => s + r.run.costUsd, 0) +
          prosecutorResults.reduce((s, r) => s + r.run.costUsd, 0),
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
        'Debate investigation cost exceeded ceiling — aborting',
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

    // Post-run metrics — persisted state first so Langfuse and dashboard
    // views are consistent even if the caller retries.
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
      toolCallCount:
        advocateResults.reduce((s, r) => s + r.run.toolCalls.length, 0) +
        prosecutorResults.reduce((s, r) => s + r.run.toolCalls.length, 0),
      turn: 0,
    });

    logger.info(
      {
        incidentId,
        winnerHypothesisId: ruling.winnerHypothesisId,
        totalCostUsd,
        advocateToolCalls: advocateResults.reduce((s, r) => s + r.run.toolCalls.length, 0),
        prosecutorToolCalls: prosecutorResults.reduce((s, r) => s + r.run.toolCalls.length, 0),
      },
      'Debate mode complete',
    );

    return result;
  }

  private async emitProgress(
    tenantId: TenantId,
    incidentId: IncidentId,
    stage: string,
    message: string,
  ): Promise<void> {
    await this.deps.eventBus.publish({
      eventType: 'investigation.progress',
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: { incidentId, stage, message },
    });
  }

  private async persistAgentEvidence(
    role: 'advocate' | 'prosecutor',
    tenantId: TenantId,
    incidentId: IncidentId,
    results: { hypothesisId: string; run: AgentRunResult }[],
  ): Promise<void> {
    for (const { hypothesisId, run } of results) {
      await this.deps.evidenceRepo.create({
        tenantId,
        incidentId,
        evidenceId: evidenceId(uuidv4()),
        agentRole: 'orchestrator',
        evidenceType: 'agent_reasoning',
        content: run.response,
        metadata: { label: `${role} summary`, toolName: role },
        createdAt: new Date().toISOString(),
      });
      for (const call of run.toolCalls) {
        await this.deps.evidenceRepo.create({
          tenantId,
          incidentId,
          evidenceId: evidenceId(uuidv4()),
          agentRole: 'orchestrator',
          evidenceType: 'agent_reasoning',
          content: (call.output ?? '').slice(0, 5000),
          metadata: { toolName: call.name, label: `${role} H${hypothesisId}: ${call.name}` },
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
}
