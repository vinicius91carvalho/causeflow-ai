import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HypothesisMode } from '../../../../src/modules/investigation/application/modes/hypothesis/index.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import type { IncidentId, TenantId } from '../../../../src/shared/domain/value-objects.js';
import type { IInvestigationToolset } from '../../../../src/modules/investigation/application/modes/shared/toolset.port.js';
import type { IHypothesisRepository } from '../../../../src/modules/investigation/domain/hypothesis.repository.js';
import type { Hypothesis } from '../../../../src/modules/investigation/domain/hypothesis.entity.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import type { IEventBus } from '../../../../src/shared/domain/events.js';
import type { AgentRunner, AgentRunResult } from '../../../../src/shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../../src/shared/application/ports/credential-vendor.port.js';
import type { ToolHandlerFactory } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import type { SeekerOutput, JudgeOutput } from '../../../../src/modules/investigation/application/modes/hypothesis/schemas.js';

const mockLogger = vi.hoisted(() => ({
    warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn(),
}));
vi.mock('../../../../src/shared/infra/logger.js', () => ({ logger: mockLogger }));

function makeIncident(): Incident {
    return {
        incidentId: incidentId('inc-1'),
        tenantId: tenantId('t-1'),
        title: 'x',
        description: 'y',
        severity: 'high',
        status: 'triaging',
        sourceProvider: 'datadog',
        sourceAlertId: 'd',
        createdAt: '2026-04-17T00:00:00Z',
        updatedAt: '2026-04-17T00:00:00Z',
    };
}

function makeIncidentRepo(): IIncidentRepository {
    return {
        create: vi.fn(),
        findById: vi.fn(async () => makeIncident()),
        findBySourceAlert: vi.fn(),
        update: vi.fn(async () => makeIncident()),
        updateStatus: vi.fn(async () => makeIncident()),
        listByTenant: vi.fn(),
        findBySeverity: vi.fn(),
        findByStatus: vi.fn(),
        listByCreatedAt: vi.fn(async () => ({ items: [], cursor: undefined })),
        findAll: vi.fn(),
    };
}

interface Harness { repo: IHypothesisRepository; state: Hypothesis[]; }

function makeHypothesisRepo(): Harness {
    const state: Hypothesis[] = [];
    const repo: IHypothesisRepository = {
        create: vi.fn(async (h: Hypothesis) => {
            state.push(h);
            return h;
        }),
        findById: vi.fn(
            async (_t: TenantId, _i: IncidentId, id: string) =>
                state.find((h) => h.hypothesisId === id) ?? null,
        ),
        listByIncident: vi.fn(async () => state),
        update: vi.fn(
            async (
                _t: TenantId,
                _i: IncidentId,
                id: string,
                patch: Partial<Hypothesis>,
            ) => {
                const h = state.find((x) => x.hypothesisId === id);
                if (!h) throw new Error('not found');
                Object.assign(h, patch);
                return h;
            },
        ),
    };
    return { repo, state };
}

function makeToolset(): IInvestigationToolset {
    return {
        buildCapabilities: vi.fn(async () => ({ hasAws: false, composioApps: [], hasRelay: false })),
        buildOrchestratorTools: vi.fn(() => []),
        buildCapabilitiesPrompt: vi.fn(() => ''),
    };
}

const evidenceRepo: IEvidenceRepository = {
    create: vi.fn(async (e: Evidence): Promise<Evidence> => e),
    findByIncident: vi.fn(async (): Promise<Evidence[]> => []),
    listByAgentRole: vi.fn(async (): Promise<Evidence[]> => []),
};
const eventBus: IEventBus = { publish: vi.fn(), subscribe: vi.fn() } as unknown as IEventBus;
const cloudProvider: CloudProvider = { name: 'stub' } as CloudProvider;
const credentialVendor: CredentialVendor = { vend: vi.fn(async () => ({ provider: 'stub', credentials: {}, region: 'sa-east-1' })) } as unknown as CredentialVendor;
const toolHandlerFactory: ToolHandlerFactory = () => async () => 'stub';

const VALIDATOR_RESULT: AgentRunResult = {
    response: 'gathered evidence',
    toolCalls: [{ name: 'aws_api_call', input: {}, output: '{}' }],
    totalUsage: { inputTokens: 1000, outputTokens: 400 },
    turns: 3,
    model: 'claude-sonnet-4-6',
    costUsd: 0.03,
};

describe('HypothesisMode — re-seek fallback', () => {
    beforeEach(() => {
        mockLogger.info.mockClear();
    });

    function buildMode(opts: { firstJudgeScores: number[]; reseekJudgeScores?: number[] }) {
        const harness = makeHypothesisRepo();
        const incidentRepo = makeIncidentRepo();
        const hypoIds: string[] = [];

        const seekerOutput: SeekerOutput = {
            hypotheses: [
                { statement: 'H1 original', rationale: 'r', priorConfidence: 0.5, informedBy: ['pattern:deploy-regression'] },
                { statement: 'H2 original', rationale: 'r', priorConfidence: 0.3, informedBy: ['pattern:connection-pool-exhaustion'] },
                { statement: 'H3 original', rationale: 'r', priorConfidence: 0.2, informedBy: ['pattern:upstream-dependency-outage'] },
            ],
        };
        const reseekOutput: SeekerOutput = {
            hypotheses: [
                { statement: 'H4 reseek', rationale: 'from observations', priorConfidence: 0.6, informedBy: ['observation:cloudwatch-error-trace'] },
                { statement: 'H5 reseek', rationale: 'from observations', priorConfidence: 0.5, informedBy: ['observation:github-pr-412'] },
            ],
        };

        let llmCallIndex = 0;
        const llmClient: LLMClient = {
            complete: vi.fn(async () => {
                llmCallIndex++;
                // Call 1: seeker. Calls 2+: judges and potentially reseek.
                let content: unknown;
                if (llmCallIndex === 1) {
                    content = seekerOutput;
                    harness.state.forEach((h) => hypoIds.push(h.hypothesisId));
                } else if (llmCallIndex === 2) {
                    // First judge with original hypotheses
                    const ids = harness.state.map((h) => h.hypothesisId);
                    content = {
                        winnerHypothesisId: ids[0],
                        potentialRootCause: 'low-confidence placeholder',
                        findings: ['initial set exhausted'],
                        recommendedActions: [],
                        evidence: [],
                        rulings: ids.map((id, i) => ({
                            hypothesisId: id,
                            finalScore: opts.firstJudgeScores[i] ?? 10,
                            status: i === 0 ? 'confirmed' : 'rejected',
                            rejectedReason: i === 0 ? undefined : 'no evidence',
                            confidence: 0.1,
                            evidenceFor: [],
                            evidenceAgainst: [],
                        })),
                    } as JudgeOutput;
                } else if (llmCallIndex === 3) {
                    // seeker.reseek (since first judge exhausted)
                    content = reseekOutput;
                } else {
                    // Second judge over all 5 hypotheses
                    const allIds = harness.state.map((h) => h.hypothesisId);
                    content = {
                        winnerHypothesisId: allIds[allIds.length - 1],
                        potentialRootCause: 'strong reseek hypothesis won',
                        findings: ['observations matched H4/H5'],
                        recommendedActions: [{
                            action: 'x', label: 'x', description: 'x', rationale: 'x',
                            riskLevel: 'low', estimatedDuration: '1m', automated: false, params: {},
                        }],
                        evidence: [],
                        rulings: allIds.map((id, i) => ({
                            hypothesisId: id,
                            finalScore: opts.reseekJudgeScores?.[i] ?? (i === allIds.length - 1 ? 85 : 10),
                            status: i === allIds.length - 1 ? 'confirmed' : 'rejected',
                            rejectedReason: i === allIds.length - 1 ? undefined : 'weak',
                            confidence: i === allIds.length - 1 ? 0.9 : 0.1,
                            evidenceFor: [],
                            evidenceAgainst: [],
                        })),
                    } as JudgeOutput;
                }
                return {
                    content,
                    usage: { inputTokens: 500, outputTokens: 300 },
                    model: 'claude-sonnet-4-6',
                    costUsd: 0.015,
                };
            }) as unknown as LLMClient['complete'],
        };

        const agentRunner: AgentRunner = {
            run: vi.fn(async () => VALIDATOR_RESULT),
        };

        const mode = new HypothesisMode({
            toolset: makeToolset(),
            hypothesisRepo: harness.repo,
            incidentRepo,
            evidenceRepo,
            eventBus,
            agentRunner,
            llmClient,
            cloudProvider,
            credentialVendor,
            toolHandlerFactory,
            disableRecon: true,
        });

        return { mode, harness, eventBus, llmClient, incidentRepo };
    }

    it('triggers re-seek when all first-judge rulings are below threshold', async () => {
        const { mode, harness, llmClient } = buildMode({
            firstJudgeScores: [20, 15, 10], // all below 50
        });

        const result = await mode.run({
            tenantId: tenantId('t-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        // 3 original + 2 reseek hypotheses persisted
        expect(harness.repo.create).toHaveBeenCalledTimes(5);
        // LLM called 4 times: seeker, judge#1, seeker.reseek, judge#2
        expect(llmClient.complete).toHaveBeenCalledTimes(4);
        // Reseek winner took over
        expect(result.potentialRootCause).toContain('reseek');
    });

    it('does NOT trigger re-seek when any first-judge ruling meets threshold', async () => {
        const { mode, harness, llmClient } = buildMode({
            firstJudgeScores: [70, 20, 10], // first one above threshold
        });

        await mode.run({
            tenantId: tenantId('t-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        // Only 3 hypotheses created (no reseek)
        expect(harness.repo.create).toHaveBeenCalledTimes(3);
        // LLM called 2 times: seeker, judge (no reseek flow)
        expect(llmClient.complete).toHaveBeenCalledTimes(2);
    });

    it('keeps original ruling if re-seek does not produce a stronger score', async () => {
        const { mode, llmClient } = buildMode({
            firstJudgeScores: [40, 30, 20], // all < 50, triggers reseek
            // reseek judge returns everything BELOW the first-judge max (40)
            reseekJudgeScores: [40, 30, 20, 30, 25],
        });

        const result = await mode.run({
            tenantId: tenantId('t-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        expect(llmClient.complete).toHaveBeenCalledTimes(4);
        // Winner was the first judge's choice (placeholder text), not reseek's
        expect(result.potentialRootCause).toContain('placeholder');
    });

    it('publishes investigation.hypotheses_exhausted when re-seek triggers', async () => {
        const publish = vi.fn();
        const customBus: IEventBus = { publish, subscribe: vi.fn() } as unknown as IEventBus;
        const harness = makeHypothesisRepo();
        const incidentRepo = makeIncidentRepo();
        const seekerOutput: SeekerOutput = {
            hypotheses: [
                { statement: 'H1', rationale: 'r', priorConfidence: 0.5, informedBy: ['pattern:deploy-regression'] },
                { statement: 'H2', rationale: 'r', priorConfidence: 0.3, informedBy: ['pattern:deploy-regression'] },
                { statement: 'H3', rationale: 'r', priorConfidence: 0.2, informedBy: ['pattern:deploy-regression'] },
            ],
        };
        let call = 0;
        const llmClient: LLMClient = {
            complete: vi.fn(async () => {
                call++;
                if (call === 1) {
                    return { content: seekerOutput as unknown as string, usage: { inputTokens: 1, outputTokens: 1 }, model: 'sonnet', costUsd: 0.01 };
                }
                if (call === 2) {
                    const ids = harness.state.map((h) => h.hypothesisId);
                    return {
                        content: {
                            winnerHypothesisId: ids[0],
                            potentialRootCause: 'x',
                            findings: ['x'],
                            recommendedActions: [],
                            evidence: [],
                            rulings: ids.map((id) => ({
                                hypothesisId: id, finalScore: 10, status: 'rejected' as const,
                                rejectedReason: 'weak', confidence: 0.1, evidenceFor: [], evidenceAgainst: [],
                            })),
                        } as unknown as string,
                        usage: { inputTokens: 1, outputTokens: 1 }, model: 'sonnet', costUsd: 0.01,
                    };
                }
                if (call === 3) {
                    return {
                        content: {
                            hypotheses: [
                                { statement: 'new1', rationale: 'r', priorConfidence: 0.5, informedBy: ['observation:x'] },
                                { statement: 'new2', rationale: 'r', priorConfidence: 0.4, informedBy: ['observation:y'] },
                            ],
                        } as unknown as string,
                        usage: { inputTokens: 1, outputTokens: 1 }, model: 'sonnet', costUsd: 0.01,
                    };
                }
                const allIds = harness.state.map((h) => h.hypothesisId);
                return {
                    content: {
                        winnerHypothesisId: allIds[allIds.length - 1],
                        potentialRootCause: 'reseek winner',
                        findings: ['y'],
                        recommendedActions: [],
                        evidence: [],
                        rulings: allIds.map((id, i) => ({
                            hypothesisId: id,
                            finalScore: i === allIds.length - 1 ? 80 : 10,
                            status: i === allIds.length - 1 ? 'confirmed' as const : 'rejected' as const,
                            rejectedReason: i === allIds.length - 1 ? undefined : 'x',
                            confidence: i === allIds.length - 1 ? 0.9 : 0.1,
                            evidenceFor: [], evidenceAgainst: [],
                        })),
                    } as unknown as string,
                    usage: { inputTokens: 1, outputTokens: 1 }, model: 'sonnet', costUsd: 0.01,
                };
            }) as unknown as LLMClient['complete'],
        };
        const agentRunner: AgentRunner = { run: vi.fn(async () => VALIDATOR_RESULT) };
        const mode = new HypothesisMode({
            toolset: makeToolset(),
            hypothesisRepo: harness.repo,
            incidentRepo,
            evidenceRepo,
            eventBus: customBus,
            agentRunner,
            llmClient,
            cloudProvider,
            credentialVendor,
            toolHandlerFactory,
            disableRecon: true,
        });

        await mode.run({
            tenantId: tenantId('t-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        const publishMock = publish as unknown as ReturnType<typeof vi.fn>;
        const publishedEvents = publishMock.mock.calls.map(
            (c: unknown[]) => (c[0] as { eventType: string }).eventType,
        );
        expect(publishedEvents).toContain('investigation.hypotheses_exhausted');
    });
});
