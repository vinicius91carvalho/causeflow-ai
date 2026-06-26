import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebateMode } from '../../../../src/modules/investigation/application/modes/debate/index.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import type { IncidentId, TenantId } from '../../../../src/shared/domain/value-objects.js';
import type { IInvestigationToolset } from '../../../../src/modules/investigation/application/modes/shared/toolset.port.js';
import type { IHypothesisRepository } from '../../../../src/modules/investigation/domain/hypothesis.repository.js';
import type { Hypothesis } from '../../../../src/modules/investigation/domain/hypothesis.entity.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import type { IEventBus } from '../../../../src/shared/domain/events.js';
import type { AgentRunner, AgentRunResult, AgentRunConfig } from '../../../../src/shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../../src/shared/application/ports/credential-vendor.port.js';
import type { ToolHandlerFactory } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import type { SeekerOutput, JudgeOutput } from '../../../../src/modules/investigation/application/modes/hypothesis/schemas.js';

const mockLogger = vi.hoisted(() => ({
    warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn(),
}));
vi.mock('../../../../src/shared/infra/logger.js', () => ({ logger: mockLogger }));

// ── Fixtures ────────────────────────────────────────────────────────

function makeIncident(overrides?: Partial<Incident>): Incident {
    return {
        incidentId: incidentId('inc-debate-1'),
        tenantId: tenantId('tenant-1'),
        title: '5xx rate spike',
        description: 'api-server errors from 0.1% → 12% at 14:32',
        severity: 'high',
        status: 'triaging',
        sourceProvider: 'datadog',
        sourceAlertId: 'dd-1',
        createdAt: '2026-04-17T00:00:00Z',
        updatedAt: '2026-04-17T00:00:00Z',
        ...overrides,
    };
}

function makeSeekerOutput(): SeekerOutput {
    return {
        hypotheses: [
            { statement: 'Recent deploy regression', rationale: 'deploy timing', priorConfidence: 0.5, informedBy: ['pattern:deploy-regression'] },
            { statement: 'DB pool exhaustion', rationale: 'past incident pattern', priorConfidence: 0.3, informedBy: ['pattern:connection-pool-exhaustion'] },
            { statement: 'Upstream dependency outage', rationale: 'cascading 5xx', priorConfidence: 0.2, informedBy: ['pattern:upstream-dependency-outage'] },
        ],
    };
}

function makeJudgeOutput(winnerHypothesisId: string, losers: string[]): JudgeOutput {
    return {
        winnerHypothesisId,
        potentialRootCause: 'Release 2.4.1 regression on /users query path',
        findings: ['Error onset aligns with deploy', 'Pool saturation ruled out by metrics', 'No upstream errors'],
        recommendedActions: [{
            action: 'rollback', label: 'Rollback', description: 'Revert release',
            rationale: 'Stops the bleed', riskLevel: 'low', estimatedDuration: '5m',
            automated: false, params: {},
        }],
        evidence: [{ type: 'log_snippet', content: 'deploy correlation' }],
        rulings: [
            {
                hypothesisId: winnerHypothesisId,
                finalScore: 85, status: 'confirmed', confidence: 0.9,
                evidenceFor: [{ summary: 'deploy timestamp matches error onset', weight: 0.9, toolName: 'composio_GITHUB_PULLS_LIST' }],
                evidenceAgainst: [],
            },
            ...losers.map((id) => ({
                hypothesisId: id, finalScore: 15, status: 'rejected' as const,
                rejectedReason: 'prosecutor found decisive counter-evidence',
                confidence: 0.1,
                evidenceFor: [],
                evidenceAgainst: [{ summary: 'no saturation observed', weight: -0.8 }],
            })),
        ],
    };
}

const BASE_AGENT_RESULT: AgentRunResult = {
    response: 'Agent summary: evidence gathered.',
    toolCalls: [{ name: 'aws_api_call', input: { service: 'cloudwatch' }, output: '{"data":"ok"}' }],
    totalUsage: { inputTokens: 1000, outputTokens: 400 },
    turns: 3,
    model: 'claude-sonnet-4-6',
    costUsd: 0.03,
};

// ── Mocks ──────────────────────────────────────────────────────────

function makeIncidentRepo(incident: Incident | null): IIncidentRepository {
    return {
        create: vi.fn(),
        findById: vi.fn(async () => incident),
        findBySourceAlert: vi.fn(),
        update: vi.fn(async (_t, _i, data) => ({ ...makeIncident(), ...data }) as Incident),
        updateStatus: vi.fn(async (_t, _i, status) => ({ ...makeIncident(), status }) as Incident),
        listByTenant: vi.fn(),
        findBySeverity: vi.fn(),
        findByStatus: vi.fn(),
        listByCreatedAt: vi.fn(),
        findAll: vi.fn(),
    };
}

interface RepoHarness { repo: IHypothesisRepository; state: Hypothesis[]; onCreate: (cb: (ids: string[]) => void) => void; }

function makeHypothesisRepo(): RepoHarness {
    const state: Hypothesis[] = [];
    const listeners: ((ids: string[]) => void)[] = [];
    const repo: IHypothesisRepository = {
        create: vi.fn(async (h: Hypothesis) => {
            state.push(h);
            listeners.forEach((cb) => cb(state.map((x) => x.hypothesisId)));
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
    return { repo, state, onCreate: (cb) => listeners.push(cb) };
}

function makeToolset(): IInvestigationToolset {
    return {
        buildCapabilities: vi.fn(async () => ({ hasAws: true, composioApps: ['github'], hasRelay: false })),
        buildOrchestratorTools: vi.fn(() => []),
        buildCapabilitiesPrompt: vi.fn(() => '\n\n## Capabilities'),
    };
}

const evidenceRepo: IEvidenceRepository = {
    create: vi.fn(async (e: Evidence) => e),
    findByIncident: vi.fn(async () => []),
    listByAgentRole: vi.fn(async () => []),
};
const eventBus: IEventBus = { publish: vi.fn(), subscribe: vi.fn() } as unknown as IEventBus;
const cloudProvider: CloudProvider = { name: 'stub' } as CloudProvider;
const credentialVendor: CredentialVendor = { vend: vi.fn(async () => ({ provider: 'stub', credentials: {}, region: 'sa-east-1' })) } as unknown as CredentialVendor;
const toolHandlerFactory: ToolHandlerFactory = () => async () => 'stub';

// ── Tests ──────────────────────────────────────────────────────────

describe('DebateMode', () => {
    beforeEach(() => {
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
    });

    function buildMode(opts?: { transformJudge?: (out: JudgeOutput) => JudgeOutput }) {
        const harness = makeHypothesisRepo();
        const incidentRepo = makeIncidentRepo(makeIncident());
        const judgeOutputRef: { current: JudgeOutput | null } = { current: null };

        harness.onCreate((ids) => {
            if (ids.length === 3 && !judgeOutputRef.current) {
                const base = makeJudgeOutput(ids[0]!, [ids[1]!, ids[2]!]);
                judgeOutputRef.current = opts?.transformJudge ? opts.transformJudge(base) : base;
            }
        });

        const seekerOutput = makeSeekerOutput();
        const llmClient: LLMClient = {
            complete: vi.fn(async () => {
                const isJudgeCall = judgeOutputRef.current !== null && harness.state.length === 3;
                const content = isJudgeCall ? judgeOutputRef.current! : seekerOutput;
                return {
                    content: content as unknown as string,
                    usage: { inputTokens: 500, outputTokens: 300 },
                    model: 'claude-sonnet-4-6',
                    costUsd: isJudgeCall ? 0.02 : 0.01,
                };
            }) as unknown as LLMClient['complete'],
        };

        // Track every AgentRunner.run() call so we can verify parallel
        // advocate + prosecutor execution.
        const agentRunCalls: AgentRunConfig[] = [];
        const agentRunner: AgentRunner = {
            run: vi.fn(async (cfg: AgentRunConfig) => {
                agentRunCalls.push(cfg);
                return { ...BASE_AGENT_RESULT, response: `response for: ${cfg.systemPrompt.slice(0, 12)}` };
            }),
        };

        const mode = new DebateMode({
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
            disableReseek: true,
        });

        return { mode, hypothesisRepo: harness.repo, incidentRepo, agentRunCalls };
    }

    it('runs seeker → 3 advocates → 3 prosecutors → judge and persists winner', async () => {
        const { mode, hypothesisRepo, incidentRepo, agentRunCalls } = buildMode();

        const result = await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-debate-1'),
            suggestedAgents: [],
        });

        // 3 created + 3 updated (judged)
        expect(hypothesisRepo.create).toHaveBeenCalledTimes(3);
        expect(hypothesisRepo.update).toHaveBeenCalledTimes(3);

        // agentRunner called 6 times — 3 advocates + 3 prosecutors
        expect(agentRunCalls).toHaveLength(6);

        // First 3 calls should be advocates (their system prompt starts with
        // the advocate header).
        const firstThree = agentRunCalls.slice(0, 3);
        const lastThree = agentRunCalls.slice(3, 6);
        expect(firstThree.every((c) => c.systemPrompt.includes('advocate'))).toBe(true);
        expect(lastThree.every((c) => c.systemPrompt.includes('prosecutor'))).toBe(true);

        // Final InvestigationResult + incident update
        expect(result.potentialRootCause).toContain('Release 2.4.1');
        expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
            tenantId('tenant-1'),
            incidentId('inc-debate-1'),
            'awaiting_approval',
        );
    });

    it('tags evidenceFor/Against with the right sourcedBy role', async () => {
        const { mode, hypothesisRepo } = buildMode();

        await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-debate-1'),
            suggestedAgents: [],
        });

        const updateCalls = (hypothesisRepo.update as unknown as ReturnType<typeof vi.fn>).mock.calls;
        const winnerUpdate = updateCalls.find((c) => c[3].status === 'confirmed');
        expect(winnerUpdate).toBeDefined();
        expect(winnerUpdate![3].evidenceFor[0].sourcedBy).toBe('advocate');

        const rejectedUpdate = updateCalls.find((c) => c[3].status === 'rejected');
        expect(rejectedUpdate).toBeDefined();
        expect(rejectedUpdate![3].evidenceAgainst[0].sourcedBy).toBe('prosecutor');
    });

    it('passes the advocate summary into its paired prosecutor', async () => {
        const { mode, agentRunCalls } = buildMode();

        await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-debate-1'),
            suggestedAgents: [],
        });

        // Every prosecutor user prompt should contain the substring that the
        // advocate response was stubbed to produce.
        const prosecutorCalls = agentRunCalls.slice(3, 6);
        for (const c of prosecutorCalls) {
            expect(c.userPrompt).toContain("Advocate's summary");
            expect(c.userPrompt).toContain('response for:');
        }
    });

    it('skips judge updates for unknown hypothesis ids and warns', async () => {
        const { mode, hypothesisRepo } = buildMode({
            transformJudge: (out) => ({
                ...out,
                rulings: [
                    ...out.rulings,
                    {
                        hypothesisId: 'ghost-id',
                        finalScore: 5, status: 'rejected',
                        rejectedReason: 'hallucinated',
                        confidence: 0.05,
                        evidenceFor: [], evidenceAgainst: [],
                    },
                ],
            }),
        });

        await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-debate-1'),
            suggestedAgents: [],
        });

        expect(hypothesisRepo.update).toHaveBeenCalledTimes(3); // NOT 4
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ unknownHypothesisId: 'ghost-id' }),
            expect.any(String),
        );
    });
});
