import { describe, it, expect, vi } from 'vitest';
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
import type { AgentRunner, AgentRunConfig, AgentRunResult } from '../../../../src/shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../../src/shared/application/ports/credential-vendor.port.js';
import type { ToolHandlerFactory } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import type { SeekerOutput, JudgeOutput } from '../../../../src/modules/investigation/application/modes/hypothesis/schemas.js';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));

function makeIncident(): Incident {
    return {
        incidentId: incidentId('inc-debate'),
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

function makeHypothesisRepo() {
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

const evidenceRepo: IEvidenceRepository = {
    create: vi.fn(async (e: Evidence) => e),
    findByIncident: vi.fn(async () => []),
    listByAgentRole: vi.fn(async () => []),
};
const eventBus: IEventBus = { publish: vi.fn(), subscribe: vi.fn() } as unknown as IEventBus;
const cloudProvider: CloudProvider = { name: 'stub' } as CloudProvider;
const credentialVendor: CredentialVendor = { vend: vi.fn(async () => ({ provider: 'stub', credentials: {}, region: 'sa-east-1' })) } as unknown as CredentialVendor;
const toolHandlerFactory: ToolHandlerFactory = () => async () => 'stub';

function makeToolset(): IInvestigationToolset {
    return {
        buildCapabilities: vi.fn(async () => ({ hasAws: false, composioApps: [], hasRelay: false })),
        buildOrchestratorTools: vi.fn(() => []),
        buildCapabilitiesPrompt: vi.fn(() => ''),
    };
}

function seekerOutput(): SeekerOutput {
    return {
        hypotheses: [
            { statement: 'H1', rationale: 'r', priorConfidence: 0.5, informedBy: ['pattern:deploy-regression'] },
            { statement: 'H2', rationale: 'r', priorConfidence: 0.3, informedBy: ['pattern:connection-pool-exhaustion'] },
            { statement: 'H3', rationale: 'r', priorConfidence: 0.2, informedBy: ['pattern:upstream-dependency-outage'] },
        ],
    };
}

function judgeOutput(ids: string[]): JudgeOutput {
    return {
        winnerHypothesisId: ids[0]!,
        potentialRootCause: 'x',
        findings: ['y'],
        recommendedActions: [],
        evidence: [],
        rulings: ids.map((id, i) => ({
            hypothesisId: id,
            finalScore: i === 0 ? 80 : 20,
            status: i === 0 ? 'confirmed' as const : 'rejected' as const,
            rejectedReason: i === 0 ? undefined : 'x',
            confidence: i === 0 ? 0.9 : 0.1,
            evidenceFor: [],
            evidenceAgainst: [],
        })),
    };
}

const AGENT_RESULT: AgentRunResult = {
    response: 'summary',
    toolCalls: [],
    totalUsage: { inputTokens: 500, outputTokens: 200 },
    turns: 2,
    model: 'claude-sonnet-4-6',
    costUsd: 0.02,
};

describe('DebateMode — Mastra sub-threads', () => {
    it('gives each advocate + prosecutor its own thread id scoped to hypothesis + role', async () => {
        const harness = makeHypothesisRepo();
        const incidentRepo = makeIncidentRepo();
        let call = 0;
        const llmClient: LLMClient = {
            complete: vi.fn(async () => {
                call++;
                if (call === 1) {
                    return { content: seekerOutput() as unknown as string, usage: { inputTokens: 1, outputTokens: 1 }, model: 'sonnet', costUsd: 0.01 };
                }
                const ids = harness.state.map((h) => h.hypothesisId);
                return { content: judgeOutput(ids) as unknown as string, usage: { inputTokens: 1, outputTokens: 1 }, model: 'sonnet', costUsd: 0.01 };
            }) as unknown as LLMClient['complete'],
        };
        const agentCalls: AgentRunConfig[] = [];
        const agentRunner: AgentRunner = {
            run: vi.fn(async (cfg: AgentRunConfig) => {
                agentCalls.push(cfg);
                return AGENT_RESULT;
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

        await mode.run({
            tenantId: tenantId('t-1'),
            incidentId: incidentId('inc-debate'),
            suggestedAgents: [],
        });

        // 6 agent calls: 3 advocates + 3 prosecutors
        expect(agentCalls).toHaveLength(6);

        // Each call should have a memory thread with unique id
        const threadIds = agentCalls.map((c) => c.memory?.thread.id);
        for (const id of threadIds) {
            expect(id).toBeDefined();
        }
        // All distinct
        expect(new Set(threadIds).size).toBe(6);

        // Advocate threads start with investigation-…-advocate-, prosecutor with -prosecutor-
        const advocateThreads = threadIds.slice(0, 3);
        const prosecutorThreads = threadIds.slice(3, 6);
        for (const t of advocateThreads) expect(t).toContain('-advocate-');
        for (const t of prosecutorThreads) expect(t).toContain('-prosecutor-');

        // Every thread id must contain the incidentId
        for (const t of threadIds) expect(t).toContain('inc-debate');

        // Each thread must also set metadata with role + hypothesisId
        const meta = agentCalls[0]!.memory?.thread.metadata;
        expect(meta).toMatchObject({ role: 'advocate', incidentId: 'inc-debate' });
        expect(meta?.hypothesisId).toBeTruthy();

        // tenantId must propagate as the Mastra resource
        expect(agentCalls[0]!.memory?.resource).toBe('t-1');
    });
});
