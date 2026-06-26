/**
 * Tests for the pre-synthesis evidence gate introduced in Sprint 02 of
 * evidence-required-no-fallback (2026-04-27_2359).
 *
 * Coverage:
 *  1. Agent produces 0 evidences → re-invocation triggered, gate logs pre_synthesis_zero_evidence.
 *  2. 0 evidences after first run, 2 evidences after re-invocation → synthesis is called and succeeds.
 *  3. 0 evidences after BOTH runs → terminateInconclusive called, synthesis NEVER invoked,
 *     status='inconclusive' persisted.
 *  4. Synthesis exhausts all 3 retries with invalid evidenceId citations → terminateInconclusive
 *     called (reason: synthesis_exhausted_with_invalid_citations).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvestigateIncidentUseCase } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import type { ToolHandlerFactory } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import type { IToolCallRepository, ToolCallLog } from '../../../../src/modules/triage/domain/tool-call.repository.js';
import type { AgentRunner, AgentRunResult } from '../../../../src/shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import type { InvestigationResult } from '../../../../src/modules/investigation/domain/investigation.types.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId, evidenceId } from '../../../../src/shared/domain/value-objects.js';

// ---------------------------------------------------------------------------
// Logger mock
// ---------------------------------------------------------------------------
const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));
vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: mockLogger,
}));

// Disable Scout and Verification agents in tests
vi.mock('../../../../src/shared/config/index.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import('../../../../src/shared/config/index.js')>();
  return {
    ...original,
    config: {
      ...original.config,
      enhancedRunner: {
        ...original.config.enhancedRunner,
        scoutAgent: false,
        verificationAgent: false,
        tenantSkills: false,
        orchestratorMode: true,
      },
    },
  };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const T_ID = tenantId('tenant-gate-test');
const I_ID = incidentId('inc-gate-001');

function makeEvidence(id: string): Evidence {
  return {
    evidenceId: evidenceId(id),
    tenantId: T_ID,
    incidentId: I_ID,
    agentRole: 'orchestrator',
    evidenceType: 'log_snippet',
    content: 'evidence content for ' + id,
    claim: 'claim ' + id,
    quote: 'verbatim quote',
    createdAt: new Date().toISOString(),
  };
}

const MOCK_AGENT_RESULT: AgentRunResult = {
  response: 'Investigation completed.',
  toolCalls: [],
  totalUsage: { inputTokens: 300, outputTokens: 100 },
  turns: 2,
  model: 'claude-haiku-4-5-20251001',
  costUsd: 0.0005,
};

const VALID_SYNTHESIS_RESULT: InvestigationResult = {
  findings: [
    {
      text: 'Memory leak detected in worker pool',
      evidenceIds: ['ev-001'],
    },
  ],
  potentialRootCause: 'Memory leak causing OOM kills',
  recommendedActions: [],
  evidence: [],
};

function makeIncident(overrides?: Partial<Incident>): Incident {
  const base: Incident = {
    incidentId: I_ID,
    tenantId: T_ID,
    title: 'Test incident for gate',
    description: 'Testing the pre-synthesis evidence gate behavior',
    severity: 'high',
    status: 'triaging',
    sourceProvider: 'datadog',
    sourceAlertId: 'alert-gate-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------
function makeIncidentRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeIncident()),
    findBySourceAlert: vi.fn(),
    update: vi.fn().mockResolvedValue(makeIncident()),
    updateStatus: vi.fn().mockResolvedValue(makeIncident({ status: 'investigating' })),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

function makeToolCallRepo(): IToolCallRepository {
  return {
    create: vi.fn().mockImplementation(async (r: ToolCallLog): Promise<ToolCallLog> => r),
    findByIncident: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
  };
}

function makeAgentRunner(): AgentRunner {
  return {
    run: vi.fn().mockResolvedValue(MOCK_AGENT_RESULT),
  };
}

function makeLLMClient(): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue({
      content: VALID_SYNTHESIS_RESULT,
      usage: { inputTokens: 200, outputTokens: 100 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.002,
    }),
  };
}

function makeCloudProvider(): CloudProvider {
  return {
    name: 'stub',
    queryLogs: vi.fn().mockResolvedValue([]),
    queryMetrics: vi.fn().mockResolvedValue([]),
    describeService: vi.fn().mockResolvedValue({ name: 'test', type: 'ECS', status: 'ACTIVE', region: 'us-east-1' }),
    executeAction: vi.fn().mockResolvedValue({ success: true }),
    testConnection: vi.fn().mockResolvedValue(true),
  };
}

const mockToolHandlerFactory: ToolHandlerFactory = () =>
  async (_name: string, _input: Record<string, unknown>): Promise<string> => JSON.stringify({ data: 'mock' });

function buildUseCase(
  incidentRepo: IIncidentRepository,
  evidenceRepo: IEvidenceRepository,
  agentRunner: AgentRunner,
  llmClient: LLMClient,
  eventBus: EventBus,
) {
  return new InvestigateIncidentUseCase({
    incidentRepo,
    evidenceRepo,
    toolCallRepo: makeToolCallRepo(),
    eventBus,
    agentRunner,
    llmClient,
    cloudProvider: makeCloudProvider(),
    toolHandlerFactory: mockToolHandlerFactory,
    defaultRegion: 'us-east-1',
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Pre-synthesis evidence gate', () => {
  let incidentRepo: IIncidentRepository;
  let evidenceRepo: IEvidenceRepository;
  let agentRunner: AgentRunner;
  let llmClient: LLMClient;
  let eventBus: EventBus;
  let useCase: InvestigateIncidentUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    incidentRepo = makeIncidentRepo();
    agentRunner = makeAgentRunner();
    llmClient = makeLLMClient();
    eventBus = new EventBus();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: 0 evidences → re-invocation triggered
  // -------------------------------------------------------------------------
  it('re-invokes orchestrator and logs pre_synthesis_zero_evidence when 0 evidences after first run', async () => {
    // First findByIncident (pre-gate) returns [] — no evidence
    // Second findByIncident (after re-invocation) returns 1 evidence so synthesis can proceed
    const ev1 = makeEvidence('ev-001');
    evidenceRepo = {
      create: vi.fn().mockImplementation(async (e: Evidence) => e),
      findByIncident: vi.fn()
        .mockResolvedValueOnce([])    // pre-gate check: 0 evidences
        .mockResolvedValueOnce([ev1]) // after re-invocation: 1 evidence → synthesis allowed
        .mockResolvedValue([ev1]),    // synthesis calls findByIncident too
      listByAgentRole: vi.fn().mockResolvedValue([]),
    };

    // Synthesis result references 'ev-001' which exists
    vi.mocked(llmClient.complete).mockResolvedValue({
      content: {
        findings: [{ text: 'Memory leak', evidenceIds: ['ev-001'] }],
        potentialRootCause: 'Memory leak',
        recommendedActions: [],
        evidence: [],
      },
      usage: { inputTokens: 200, outputTokens: 100 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.002,
    });

    useCase = buildUseCase(incidentRepo, evidenceRepo, agentRunner, llmClient, eventBus);

    await useCase.execute({ tenantId: T_ID, incidentId: I_ID, suggestedAgents: [] });

    // Gate was triggered: agentRunner called at least twice (original + re-invocation)
    expect(vi.mocked(agentRunner.run).mock.calls.length).toBeGreaterThanOrEqual(2);

    // Gate warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        incidentId: I_ID,
        tenantId: T_ID,
        event: 'pre_synthesis_zero_evidence',
      }),
      expect.stringContaining('Pre-synthesis gate'),
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 2: 0 evidences → re-invocation → 2 evidences → synthesis succeeds
  // -------------------------------------------------------------------------
  it('calls synthesis when re-invocation produces evidences', async () => {
    const ev1 = makeEvidence('ev-001');
    const ev2 = makeEvidence('ev-002');
    evidenceRepo = {
      create: vi.fn().mockImplementation(async (e: Evidence) => e),
      findByIncident: vi.fn()
        .mockResolvedValueOnce([])         // pre-gate: 0 evidences
        .mockResolvedValueOnce([ev1, ev2]) // after re-invocation: 2 evidences
        .mockResolvedValue([ev1, ev2]),    // synthesis validation calls
      listByAgentRole: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(llmClient.complete).mockResolvedValue({
      content: {
        findings: [
          { text: 'Memory leak', evidenceIds: ['ev-001'] },
          { text: 'OOM kill', evidenceIds: ['ev-002'] },
        ],
        potentialRootCause: 'Memory leak causing OOM',
        recommendedActions: [],
        evidence: [],
      },
      usage: { inputTokens: 200, outputTokens: 100 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.002,
    });

    useCase = buildUseCase(incidentRepo, evidenceRepo, agentRunner, llmClient, eventBus);

    await useCase.execute({ tenantId: T_ID, incidentId: I_ID, suggestedAgents: [] });

    // Synthesis was called
    expect(vi.mocked(llmClient.complete)).toHaveBeenCalled();

    // Status set to resolved (recommendedActions is empty) or awaiting_approval
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      T_ID,
      I_ID,
      expect.stringMatching(/^(resolved|awaiting_approval)$/),
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 3: 0 evidences after BOTH runs → terminateInconclusive
  // -------------------------------------------------------------------------
  it('marks incident inconclusive and NEVER calls synthesis when 0 evidences after both runs', async () => {
    evidenceRepo = {
      create: vi.fn().mockImplementation(async (e: Evidence) => e),
      findByIncident: vi.fn()
        .mockResolvedValueOnce([]) // pre-gate: 0
        .mockResolvedValueOnce([]) // after re-invocation: still 0
        .mockResolvedValue([]),
      listByAgentRole: vi.fn().mockResolvedValue([]),
    };

    const inconclusiveHandler = vi.fn();
    eventBus.subscribe('investigation.inconclusive', inconclusiveHandler);

    useCase = buildUseCase(incidentRepo, evidenceRepo, agentRunner, llmClient, eventBus);

    await useCase.execute({ tenantId: T_ID, incidentId: I_ID, suggestedAgents: [] });

    // Synthesis NEVER called
    expect(vi.mocked(llmClient.complete)).not.toHaveBeenCalled();

    // Status updated to 'inconclusive'
    expect(incidentRepo.update).toHaveBeenCalledWith(
      T_ID,
      I_ID,
      expect.objectContaining({ status: 'inconclusive' }),
    );

    // EventBus event published
    expect(inconclusiveHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'investigation.inconclusive',
        tenantId: T_ID,
        payload: expect.objectContaining({
          incidentId: I_ID,
          reason: 'agent_failed_to_cite_evidence_after_reinvocation',
        }),
      }),
    );

    // Logger.warn was called for inconclusive terminal
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        incidentId: I_ID,
        tenantId: T_ID,
        reason: 'agent_failed_to_cite_evidence_after_reinvocation',
      }),
      expect.stringContaining('inconclusive'),
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Synthesis exhausts all retries → terminateInconclusive
  // -------------------------------------------------------------------------
  it('marks incident inconclusive when synthesis exhausts all retries with invalid evidenceId citations', async () => {
    // Provide evidence so the gate passes, but synthesis keeps citing a non-existent evidenceId
    const ev1 = makeEvidence('ev-real-001');
    evidenceRepo = {
      create: vi.fn().mockImplementation(async (e: Evidence) => e),
      findByIncident: vi.fn()
        .mockResolvedValueOnce([ev1]) // pre-gate: 1 evidence → gate passes
        .mockResolvedValue([ev1]),    // subsequent synthesis calls
      listByAgentRole: vi.fn().mockResolvedValue([]),
    };

    // Synthesis always cites a bogus evidenceId
    vi.mocked(llmClient.complete).mockResolvedValue({
      content: {
        findings: [{ text: 'Bad finding', evidenceIds: ['ev-nonexistent'] }],
        potentialRootCause: 'Unknown cause',
        recommendedActions: [],
        evidence: [],
      },
      usage: { inputTokens: 200, outputTokens: 100 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.002,
    });

    const inconclusiveHandler = vi.fn();
    eventBus.subscribe('investigation.inconclusive', inconclusiveHandler);

    useCase = buildUseCase(incidentRepo, evidenceRepo, agentRunner, llmClient, eventBus);

    await useCase.execute({ tenantId: T_ID, incidentId: I_ID, suggestedAgents: [] });

    // Status updated to 'inconclusive'
    expect(incidentRepo.update).toHaveBeenCalledWith(
      T_ID,
      I_ID,
      expect.objectContaining({ status: 'inconclusive' }),
    );

    // EventBus event published with synthesis_exhausted reason
    expect(inconclusiveHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'investigation.inconclusive',
        payload: expect.objectContaining({
          reason: 'synthesis_exhausted_with_invalid_citations',
        }),
      }),
    );

    // Synthesis was attempted (llmClient.complete WAS called — it just kept failing)
    expect(vi.mocked(llmClient.complete)).toHaveBeenCalled();
  });
});
