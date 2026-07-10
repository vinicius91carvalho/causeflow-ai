import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TriageIncidentUseCase } from '../../../../src/modules/triage/application/triage-incident.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { MessageQueue } from '../../../../src/shared/application/ports/message-queue.port.js';
import type { TriageResult } from '../../../../src/modules/triage/domain/triage.types.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError, ConflictError } from '../../../../src/shared/domain/errors.js';

const MOCK_TRIAGE_RESULT: TriageResult = {
  priority: 'high',
  category: 'infrastructure',
  suggestedAgents: ['log_analyst', 'metric_analyst'],
  summary: 'High CPU usage detected on production API server',
  confidence: 0.85,
  investigationMode: 'orchestrator',
};

function createMockIncident(overrides?: Partial<Incident>): Incident {
  return {
    incidentId: incidentId('inc-123'),
    tenantId: tenantId('tenant-1'),
    title: 'High CPU on api-server',
    description: 'CPU usage at 95% for 10 minutes',
    severity: 'critical',
    status: 'open',
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
    updateStatus: vi.fn(async (_t, _i, status) => ({ ...createMockIncident(), status }) as Incident),
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

function createMockLLMClient(): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue({
      content: MOCK_TRIAGE_RESULT,
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.00105,
    }),
  };
}

function createMockMessageQueue(): MessageQueue {
  return {
    send: vi.fn(async () => {}),
  };
}

describe('TriageIncidentUseCase', () => {
  let incidentRepo: IIncidentRepository;
  let evidenceRepo: IEvidenceRepository;
  let llmClient: LLMClient;
  let eventBus: EventBus;
  let messageQueue: MessageQueue;
  let useCase: TriageIncidentUseCase;

  beforeEach(() => {
    incidentRepo = createMockIncidentRepo();
    evidenceRepo = createMockEvidenceRepo();
    llmClient = createMockLLMClient();
    eventBus = new EventBus();
    messageQueue = createMockMessageQueue();
    useCase = new TriageIncidentUseCase(
      incidentRepo,
      evidenceRepo,
      eventBus,
      llmClient,
      messageQueue,
      'http://localhost:4566/000000000000/causeflow-investigation',
    );
  });

  it('should triage an open incident successfully', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());

    const result = await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    expect(result).toEqual(MOCK_TRIAGE_RESULT);
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      'triaging',
    );
    expect(llmClient.complete).toHaveBeenCalledTimes(1);
    expect(incidentRepo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      expect.objectContaining({
        severity: 'high',
        assignedAgents: ['log_analyst', 'metric_analyst'],
        investigationMode: 'orchestrator',
      }),
    );
    expect(evidenceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agentRole: 'coordinator',
        evidenceType: 'agent_reasoning',
        content: 'High CPU usage detected on production API server',
        metadata: { confidence: 0.85, category: 'infrastructure' },
      }),
    );
  });

  it('should publish incident.status_changed event', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());
    const handler = vi.fn();
    eventBus.subscribe('incident.status_changed', handler);

    await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'incident.status_changed',
      payload: { incidentId: 'inc-123', from: 'open', to: 'triaging' },
    });
  });

  it('should throw NotFoundError when incident does not exist', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('inc-999')),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError when incident is not in open status', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(
      createMockIncident({ status: 'triaging' }),
    );

    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('inc-123')),
    ).rejects.toThrow(ConflictError);
  });

  it('should fall back to default high-severity when LLM returns invalid response', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());
    vi.mocked(llmClient.complete).mockRejectedValueOnce(new Error('Invalid JSON response'));

    const result = await useCase.execute(
      tenantId('tenant-1'),
      incidentId('inc-123'),
    );

    // Fallback result should enqueue investigation (high priority + default agents)
    expect(result.priority).toBe('high');
    expect(result.confidence).toBe(0);
    expect(result.category).toBe('unknown');
    expect(result.investigationMode).toBe('orchestrator');
    expect(result.suggestedAgents).toEqual([
      'log_analyst',
      'metric_analyst',
      'change_detector',
      'code_analyzer',
      'infra_inspector',
      'db_analyst',
    ]);

    // Incident updated with fallback severity
    expect(incidentRepo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      expect.objectContaining({
        severity: 'high',
      }),
    );

    expect(messageQueue.send).toHaveBeenCalledWith(
      'http://localhost:4566/000000000000/causeflow-investigation',
      expect.objectContaining({
        incidentId: 'inc-123',
        severity: 'high',
      }),
    );
  });

  it('should enqueue to investigation queue when priority is critical', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());
    vi.mocked(llmClient.complete).mockResolvedValueOnce({
      content: { ...MOCK_TRIAGE_RESULT, priority: 'critical' },
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.00105,
    });

    await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    expect(messageQueue.send).toHaveBeenCalledWith(
      'http://localhost:4566/000000000000/causeflow-investigation',
      expect.objectContaining({
        incidentId: 'inc-123',
        tenantId: 'tenant-1',
        severity: 'critical',
        investigationMode: 'orchestrator',
      }),
    );
  });

  it('should not enqueue when priority is low', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());
    vi.mocked(llmClient.complete).mockResolvedValueOnce({
      content: { ...MOCK_TRIAGE_RESULT, priority: 'low' },
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.00105,
    });

    await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    expect(messageQueue.send).not.toHaveBeenCalled();
  });
});
