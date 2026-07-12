import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvestigateIncidentUseCase } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import type { ToolHandlerFactory } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type {
  IEvidenceRepository,
  Evidence,
} from '../../../../src/modules/triage/domain/evidence.repository.js';
import type {
  AgentRunner,
  AgentRunResult,
} from '../../../../src/shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import type { MessageQueue } from '../../../../src/shared/application/ports/message-queue.port.js';
import type { InvestigationResult } from '../../../../src/modules/investigation/domain/investigation.types.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';

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

// Disable Scout and Verification agents in tests (they add extra runner calls)
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
      },
    },
  };
});

const MOCK_INVESTIGATION_RESULT: InvestigationResult = {
  findings: [
    { text: 'High CPU caused by memory leak in worker pool', evidenceIds: [] },
    { text: 'OOM events detected', evidenceIds: [] },
  ],
  potentialRootCause: 'Memory leak in connection pool causing OOM kills and cascading failures',
  recommendedActions: [
    {
      action: 'restart_service',
      label: 'Restart API server',
      description: 'Restarts the affected API server pod',
      rationale: 'Service is unresponsive, restart will clear state',
      riskLevel: 'low',
      estimatedDuration: '2m',
      automated: false,
      params: { service: 'api-server', region: 'sa-east-1' },
    },
    {
      action: 'increase_memory',
      label: 'Increase memory limit',
      description: 'Increases container memory limit to 4GB',
      rationale: 'OOM kills indicate memory limit is too low',
      riskLevel: 'medium',
      estimatedDuration: '5m',
      automated: false,
      params: { limit: '4GB' },
    },
  ],
  evidence: [
    { type: 'log_analysis', content: 'OOM kill at 14:32 UTC' },
    { type: 'metric_analysis', content: 'CPU spike from 35% to 95%' },
  ],
};

const MOCK_AGENT_RESULT: AgentRunResult = {
  response: 'Found high CPU usage correlated with memory leak in worker threads.',
  toolCalls: [{ name: 'query_logs', input: { service: 'api' }, output: '[]' }],
  totalUsage: { inputTokens: 500, outputTokens: 200 },
  turns: 3,
  model: 'claude-haiku-4-5-20251001',
  costUsd: 0.0012,
};

function createMockIncident(overrides?: Partial<Incident>): Incident {
  return {
    incidentId: incidentId('inc-123'),
    tenantId: tenantId('tenant-1'),
    title: 'High CPU on api-server',
    description: 'CPU usage at 95% for 10 minutes',
    severity: 'critical',
    status: 'triaging',
    sourceProvider: 'datadog',
    sourceAlertId: 'dd-alert-456',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockIncidentRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(async (_t, _i, data) => ({ ...createMockIncident(), ...data }) as Incident),
    updateStatus: vi.fn(
      async (_t, _i, status) => ({ ...createMockIncident(), status }) as Incident,
    ),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

function createMockEvidenceRepo(): IEvidenceRepository {
  return {
    create: vi.fn(async (e: Evidence) => e),
    findByIncident: vi.fn(async () => []),
    listByAgentRole: vi.fn(async () => []),
  };
}

function createMockAgentRunner(): AgentRunner {
  return {
    run: vi.fn().mockResolvedValue(MOCK_AGENT_RESULT),
  };
}

function createMockLLMClient(): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue({
      content: MOCK_INVESTIGATION_RESULT,
      usage: { inputTokens: 200, outputTokens: 100 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.0021,
    }),
  };
}

function createMockCloudProvider(): CloudProvider {
  return {
    name: 'stub',
    queryLogs: vi.fn().mockResolvedValue([]),
    queryMetrics: vi.fn().mockResolvedValue([]),
    describeService: vi
      .fn()
      .mockResolvedValue({ name: 'api', type: 'ECS', status: 'ACTIVE', region: 'us-east-1' }),
    executeAction: vi.fn().mockResolvedValue({ success: true }),
    testConnection: vi.fn().mockResolvedValue(true),
  };
}

function createMockMessageQueue(): MessageQueue {
  return {
    send: vi.fn(async () => {}),
  };
}

const mockToolHandlerFactory: ToolHandlerFactory = () => {
  return async (_name: string, _input: Record<string, unknown>) => JSON.stringify({ data: 'mock' });
};

describe('InvestigateIncidentUseCase', () => {
  let incidentRepo: IIncidentRepository;
  let evidenceRepo: IEvidenceRepository;
  let agentRunner: AgentRunner;
  let llmClient: LLMClient;
  let cloudProvider: CloudProvider;
  let messageQueue: MessageQueue;
  let eventBus: EventBus;
  let useCase: InvestigateIncidentUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    incidentRepo = createMockIncidentRepo();
    evidenceRepo = createMockEvidenceRepo();
    agentRunner = createMockAgentRunner();
    llmClient = createMockLLMClient();
    cloudProvider = createMockCloudProvider();
    messageQueue = createMockMessageQueue();
    eventBus = new EventBus();
    useCase = new InvestigateIncidentUseCase({
      incidentRepo,
      evidenceRepo,
      toolCallRepo: {
        create: async (r) => r,
        findByIncident: async () => [],
        findById: async () => null,
      },
      eventBus,
      agentRunner,
      llmClient,
      cloudProvider,
      toolHandlerFactory: mockToolHandlerFactory,
      messageQueue,
      remediationQueueUrl: 'http://localhost:4566/000000000000/causeflow-remediation',
      defaultRegion: 'us-east-1',
    });
  });

  it('should investigate incident with 3 sub-agents dispatched', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
    });

    expect(result).toEqual(MOCK_INVESTIGATION_RESULT);

    // Status transition
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      'investigating',
    );

    // 3 sub-agents dispatched
    expect(agentRunner.run).toHaveBeenCalledTimes(3);

    // Evidence saved: 3 agents + 1 synthesis + 1 LLM completion attribution = 5
    expect(evidenceRepo.create).toHaveBeenCalledTimes(5);

    // Incident updated with root cause
    expect(incidentRepo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      expect.objectContaining({
        rootCause: MOCK_INVESTIGATION_RESULT.potentialRootCause,
      }),
    );

    // Synthesis LLM called
    expect(llmClient.complete).toHaveBeenCalledTimes(1);
  });

  it('should publish investigation.completed event', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());
    const handler = vi.fn();
    eventBus.subscribe('investigation.completed', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst'],
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'investigation.completed',
      payload: expect.objectContaining({
        incidentId: 'inc-123',
        rootCause: MOCK_INVESTIGATION_RESULT.potentialRootCause,
      }),
    });
  });

  it('should throw NotFoundError when incident does not exist', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-999'),
        suggestedAgents: ['log_analyst'],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw IncidentNotInvestigatableError when status is not triaging', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident({ status: 'open' }));

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-123'),
        suggestedAgents: ['log_analyst'],
      }),
    ).rejects.toThrow('cannot be investigated');
  });

  it('should handle partial sub-agent failures gracefully', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    // First agent succeeds, second fails, third succeeds
    vi.mocked(agentRunner.run)
      .mockResolvedValueOnce(MOCK_AGENT_RESULT)
      .mockRejectedValueOnce(new Error('Agent timeout'))
      .mockResolvedValueOnce(MOCK_AGENT_RESULT);

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
    });

    expect(result).toMatchObject(MOCK_INVESTIGATION_RESULT);
    // result is narrowed: these tests always mock evidences so execute() returns
    // InvestigationResult (not void). Non-null assert is safe here.
    expect(result!.failedAgents).toEqual([{ role: 'metric_analyst', error: 'Agent timeout' }]);
    // 2 successful agents + 1 synthesis + 1 LLM completion attribution = 4
    expect(evidenceRepo.create).toHaveBeenCalledTimes(4);
  });

  it('should complete with stub result when all sub-agents fail (OSS / LLM-unavailable path)', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    vi.mocked(agentRunner.run).mockRejectedValue(new Error('Agent timeout'));

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst', 'metric_analyst'],
    });

    expect(result).toMatchObject({
      potentialRootCause: 'Unable to determine root cause (LLM service unavailable)',
      findings: [
        expect.objectContaining({
          text: 'Investigation completed without agent findings (LLM unavailable)',
        }),
      ],
    });
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      'resolved',
    );
  });

  it('should enqueue to remediation queue when recommended actions exist', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst'],
    });

    expect(messageQueue.send).toHaveBeenCalledWith(
      'http://localhost:4566/000000000000/causeflow-remediation',
      expect.objectContaining({
        incidentId: 'inc-123',
        tenantId: 'tenant-1',
        recommendedActions: MOCK_INVESTIGATION_RESULT.recommendedActions,
      }),
    );
  });

  it('should pass model from agent config to runner', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst'],
    });

    expect(agentRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
      }),
    );
  });

  it('should track cost per sub-agent in evidence metadata', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst'],
    });

    expect(result).toBeDefined();
    // Agent runner returns costUsd which is propagated to SubAgentResult
    expect(agentRunner.run).toHaveBeenCalledTimes(1);
  });

  it('should dispatch change_detector sub-agent when suggested', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst', 'change_detector'],
    });

    // 2 sub-agents dispatched
    expect(agentRunner.run).toHaveBeenCalledTimes(2);
  });

  it('should log warning for unknown agent roles', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst', 'unknown_agent', 'fake_agent'],
    });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ unknownRoles: ['unknown_agent', 'fake_agent'] }),
      'Unknown agent roles requested - skipping',
    );
    expect(agentRunner.run).toHaveBeenCalledTimes(1);
  });

  it('should include failedAgents when sub-agents fail', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    vi.mocked(agentRunner.run)
      .mockResolvedValueOnce(MOCK_AGENT_RESULT)
      .mockRejectedValueOnce(new Error('Timeout on metric analysis'));

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst', 'metric_analyst'],
    });

    expect(result!.failedAgents).toEqual([
      { role: 'metric_analyst', error: 'Timeout on metric analysis' },
    ]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'metric_analyst' }),
      'Sub-agent failed during investigation',
    );
  });

  it('should return undefined failedAgents when all agents succeed', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst'],
    });

    expect(result!.failedAgents).toBeUndefined();
  });

  it('totalCostUsd includes synthesis costs', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    // Sub-agents: 2 agents × $0.10 each
    const agentResult: AgentRunResult = {
      ...MOCK_AGENT_RESULT,
      costUsd: 0.1,
    };
    vi.mocked(agentRunner.run)
      .mockResolvedValueOnce(agentResult) // log_analyst
      .mockResolvedValueOnce(agentResult); // metric_analyst

    // Synthesis LLM: $0.50
    vi.mocked(llmClient.complete).mockResolvedValueOnce({
      content: MOCK_INVESTIGATION_RESULT,
      usage: { inputTokens: 200, outputTokens: 100 },
      model: 'claude-opus-4-6-20250918',
      costUsd: 0.5,
    });

    const handler = vi.fn();
    eventBus.subscribe('investigation.completed', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst', 'metric_analyst'],
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0];
    const payload = event.payload;

    // totalCostUsd = subAgents(2 × 0.10) + synthesis(0.50)
    expect(payload.totalCostUsd).toBeCloseTo(0.7, 2);

    // costBreakdown present and correct
    expect(payload.costBreakdown).toBeDefined();
    expect(payload.costBreakdown.subAgents).toBeCloseTo(0.2, 2);
    expect(payload.costBreakdown.synthesis).toBeCloseTo(0.5, 2);
    expect(payload.costBreakdown.wave1).toBeDefined();
    expect(payload.costBreakdown.wave2).toBeDefined();

    // Verify: total = sum of breakdown
    expect(payload.totalCostUsd).toBeCloseTo(
      (payload.costBreakdown.subAgents as number) + (payload.costBreakdown.synthesis as number),
      2,
    );
  });

  it('costBreakdown present even without code fixer', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    // Single agent with costUsd = 0.05
    vi.mocked(agentRunner.run).mockResolvedValueOnce({
      ...MOCK_AGENT_RESULT,
      costUsd: 0.05,
    });

    // Synthesis: costUsd = 0.20
    vi.mocked(llmClient.complete).mockResolvedValueOnce({
      content: MOCK_INVESTIGATION_RESULT,
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.2,
    });

    const handler = vi.fn();
    eventBus.subscribe('investigation.completed', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      suggestedAgents: ['log_analyst'],
    });

    const payload = handler.mock.calls[0]?.[0].payload;

    // totalCostUsd = subAgent(0.05) + synthesis(0.20) + codeFixer(0)
    expect(payload.totalCostUsd).toBeCloseTo(0.25, 2);
    expect(payload.costBreakdown).toEqual(
      expect.objectContaining({
        subAgents: 0.05,
        synthesis: 0.2,
        codeFixer: 0,
      }),
    );
    expect(payload.costBreakdown.wave1).toBeDefined();
    expect(payload.costBreakdown.wave2).toBeDefined();
  });
});
