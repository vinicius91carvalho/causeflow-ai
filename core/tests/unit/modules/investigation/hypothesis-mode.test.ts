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
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
}));
vi.mock('../../../../src/shared/infra/logger.js', () => ({ logger: mockLogger }));

// ── Fixtures ─────────────────────────────────────────────────────────

function makeIncident(overrides?: Partial<Incident>): Incident {
    return {
        incidentId: incidentId('inc-1'),
        tenantId: tenantId('tenant-1'),
        title: 'API 5xx rate spike',
        description: 'api-server 500 error rate went from 0.1% to 12% at 14:32 UTC',
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
            { statement: 'Recent deploy introduced a regression', rationale: 'timing correlates with release', priorConfidence: 0.5, informedBy: ['pattern:deploy-regression'] },
            { statement: 'Database connection pool exhaustion', rationale: 'pattern in similar past incidents', priorConfidence: 0.3, informedBy: ['pattern:connection-pool-exhaustion'] },
            { statement: 'Upstream dependency outage', rationale: 'cascading 5xx from downstream', priorConfidence: 0.2, informedBy: ['pattern:upstream-dependency-outage'] },
        ],
    };
}

function makeJudgeOutput(winnerHypothesisId: string, losers: string[]): JudgeOutput {
    return {
        winnerHypothesisId,
        potentialRootCause: 'Release 2.4.1 of api-server introduced a query regression on /users endpoint',
        findings: [
            'Error rate spike started at 14:32 UTC, exactly 3 minutes after release 2.4.1 rollout',
            'Failing requests are concentrated on /users endpoint',
            'No DB pool saturation observed; no upstream errors in traces',
        ],
        recommendedActions: [
            {
                action: 'rollback',
                label: 'Rollback api-server to 2.4.0',
                description: 'Revert to previous good release',
                rationale: 'Stops the bleed while fix is prepared',
                riskLevel: 'low',
                estimatedDuration: '5m',
                automated: false,
                params: { service: 'api-server', targetVersion: '2.4.0' },
            },
        ],
        evidence: [{ type: 'log_snippet', content: 'release correlation confirmed' }],
        customerExplanation: {
            summary: 'A new release caused errors on /users',
            impact: '12% of requests failed briefly',
            resolution: 'Rolling back',
        },
        rulings: [
            {
                hypothesisId: winnerHypothesisId,
                finalScore: 85,
                status: 'confirmed',
                confidence: 0.9,
                evidenceFor: [{ summary: 'deploy timestamp matches error onset', weight: 0.9, toolName: 'composio_GITHUB_PULLS_LIST' }],
                evidenceAgainst: [],
            },
            ...losers.map((id) => ({
                hypothesisId: id,
                finalScore: 20,
                status: 'rejected' as const,
                rejectedReason: 'no supporting metric/trace signal',
                confidence: 0.1,
                evidenceFor: [],
                evidenceAgainst: [{ summary: 'no anomaly detected', weight: -0.7 }],
            })),
        ],
    };
}

const BASE_AGENT_RESULT: AgentRunResult = {
    response: 'H1: strong correlation with deploy (PR #412). H2: no DB saturation. H3: no upstream errors.',
    toolCalls: [
        { name: 'aws_api_call', input: { service: 'cloudwatch', action: 'GetMetricData' }, output: '{"errors":1200}' },
        { name: 'composio_GITHUB_PULLS_LIST', input: { state: 'closed' }, output: '[{"merged_at":"2026-04-17T14:29:00Z"}]' },
    ],
    totalUsage: { inputTokens: 2000, outputTokens: 800 },
    turns: 4,
    model: 'claude-sonnet-4-6',
    costUsd: 0.05,
};

// ── Mocks ────────────────────────────────────────────────────────────

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

interface HypothesisRepoHarness {
    repo: IHypothesisRepository;
    state: Hypothesis[];
    /** Fires after every create() call with the growing list of created ids. */
    onCreate: (cb: (ids: string[]) => void) => void;
}

function makeHypothesisRepo(): HypothesisRepoHarness {
    const state: Hypothesis[] = [];
    const createListeners: ((ids: string[]) => void)[] = [];
    const repo: IHypothesisRepository = {
        create: vi.fn(async (h: Hypothesis) => {
            state.push(h);
            const ids = state.map((x) => x.hypothesisId);
            for (const cb of createListeners) cb(ids);
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
                const existing = state.find((h) => h.hypothesisId === id);
                if (!existing) throw new Error('not found');
                Object.assign(existing, patch);
                return existing;
            },
        ),
    };
    return {
        repo,
        state,
        onCreate: (cb) => createListeners.push(cb),
    };
}

function makeEvidenceRepo(): IEvidenceRepository {
    return {
        create: vi.fn(async (e: Evidence) => e),
        findByIncident: vi.fn(async () => []),
        listByAgentRole: vi.fn(async () => []),
    };
}

function makeEventBus(): IEventBus {
    return { publish: vi.fn(), subscribe: vi.fn() } as unknown as IEventBus;
}

function makeToolset(): IInvestigationToolset {
    return {
        buildCapabilities: vi.fn(async () => ({ hasAws: true, composioApps: ['github'], hasRelay: false })),
        buildOrchestratorTools: vi.fn(() => []),
        buildCapabilitiesPrompt: vi.fn(() => '\n\n## Capabilities\n- AWS\n- GitHub'),
    };
}

function makeAgentRunner(result = BASE_AGENT_RESULT): AgentRunner {
    return { run: vi.fn(async () => result) };
}

const toolHandlerFactory: ToolHandlerFactory = () => async () => 'stub';

const cloudProvider: CloudProvider = { name: 'stub' } as CloudProvider;
const credentialVendor: CredentialVendor = {
    vend: vi.fn(async () => ({ provider: 'stub', credentials: {}, region: 'sa-east-1' })),
} as unknown as CredentialVendor;

// ── Tests ────────────────────────────────────────────────────────────

describe('HypothesisMode', () => {
    beforeEach(() => {
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
    });

    function buildMode(opts?: { agentResult?: AgentRunResult; transformJudge?: (out: JudgeOutput) => JudgeOutput }) {
        const seekerOutput = makeSeekerOutput();
        const harness = makeHypothesisRepo();
        const incidentRepo = makeIncidentRepo(makeIncident());
        const evidenceRepo = makeEvidenceRepo();
        const eventBus = makeEventBus();
        const toolset = makeToolset();
        const judgeOutputRef: { current: JudgeOutput | null } = { current: null };

        // When the seeker finishes creating all 3 hypotheses, build a matching
        // judge output keyed off the real ids and allow the test to mutate it.
        harness.onCreate((ids) => {
            if (ids.length === 3 && !judgeOutputRef.current) {
                const base = makeJudgeOutput(ids[0]!, [ids[1]!, ids[2]!]);
                judgeOutputRef.current = opts?.transformJudge ? opts.transformJudge(base) : base;
            }
        });

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
        const agentRunner = makeAgentRunner(opts?.agentResult);

        const mode = new HypothesisMode({
            toolset,
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

        return { mode, hypothesisRepo: harness.repo, incidentRepo, evidenceRepo, eventBus, toolset, llmClient, agentRunner };
    }

    it('runs seeker → validator → judge and returns the winner as rootCause', async () => {
        const { mode, hypothesisRepo, incidentRepo } = buildMode();

        const result = await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        expect(result.potentialRootCause).toContain('Release 2.4.1');
        expect(result.recommendedActions).toHaveLength(1);

        expect(hypothesisRepo.create).toHaveBeenCalledTimes(3);
        expect(hypothesisRepo.update).toHaveBeenCalledTimes(3);

        expect(incidentRepo.update).toHaveBeenCalledWith(
            tenantId('tenant-1'),
            incidentId('inc-1'),
            expect.objectContaining({ rootCause: expect.stringContaining('Release 2.4.1') }),
        );
        expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
            tenantId('tenant-1'),
            incidentId('inc-1'),
            'awaiting_approval',
        );
    });

    it('persists judge evidence onto each hypothesis (for + against)', async () => {
        const { mode, hypothesisRepo } = buildMode();

        await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        const updateCalls = (hypothesisRepo.update as unknown as ReturnType<typeof vi.fn>).mock.calls;
        const winnerUpdate = updateCalls.find((c) => c[3].status === 'confirmed');
        expect(winnerUpdate).toBeDefined();
        expect(winnerUpdate![3].evidenceFor).toHaveLength(1);
        expect(winnerUpdate![3].evidenceFor[0].sourcedBy).toBe('judge');
        expect(winnerUpdate![3].finalScore).toBe(85);

        const rejectedUpdates = updateCalls.filter((c) => c[3].status === 'rejected');
        expect(rejectedUpdates).toHaveLength(2);
        expect(rejectedUpdates[0]![3].rejectedReason).toBeDefined();
    });

    it('sets status=resolved when no recommended actions', async () => {
        const { mode, incidentRepo } = buildMode({
            transformJudge: (out) => ({ ...out, recommendedActions: [] }),
        });

        await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
            tenantId('tenant-1'),
            incidentId('inc-1'),
            'resolved',
        );
    });

    it('skips judge updates for unknown hypothesis ids and warns', async () => {
        const { mode, hypothesisRepo } = buildMode({
            transformJudge: (out) => ({
                ...out,
                rulings: [
                    ...out.rulings,
                    {
                        hypothesisId: 'ghost-id',
                        finalScore: 5,
                        status: 'rejected',
                        rejectedReason: 'hallucinated by judge',
                        confidence: 0.05,
                        evidenceFor: [],
                        evidenceAgainst: [],
                    },
                ],
            }),
        });

        await mode.run({
            tenantId: tenantId('tenant-1'),
            incidentId: incidentId('inc-1'),
            suggestedAgents: [],
        });

        expect(hypothesisRepo.update).toHaveBeenCalledTimes(3); // NOT 4
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ unknownHypothesisId: 'ghost-id' }),
            expect.any(String),
        );
    });
});
