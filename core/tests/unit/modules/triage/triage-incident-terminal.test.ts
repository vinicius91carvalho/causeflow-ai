/**
 * Terminal-triage conclusion tests
 *
 * Verifies that when the triage LLM picks a low/medium/info priority
 * (resultRank > threshold), the use case:
 *   1. Writes rootCause to the incident
 *   2. Transitions status triaging → resolved via UpdateIncidentStatusUseCase
 *   3. Does NOT enqueue to the investigation queue
 *
 * Also regression-guards the high-severity path (worker IS dispatched).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TriageIncidentUseCase } from '../../../../src/modules/triage/application/triage-incident.usecase.js';
import { UpdateIncidentStatusUseCase } from '../../../../src/modules/ingestion/application/update-incident-status.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { MessageQueue } from '../../../../src/shared/application/ports/message-queue.port.js';
import type { TriageResult } from '../../../../src/modules/triage/domain/triage.types.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

const INVESTIGATION_QUEUE_URL = 'http://localhost:4566/000000000000/causeflow-investigation';

const LOW_PRIORITY_RESULT: TriageResult = {
  priority: 'low',
  category: 'unknown',
  suggestedAgents: ['log_analyst'],
  summary: 'manual test',
  confidence: 0.9,
  investigationMode: 'orchestrator',
};

const CRITICAL_PRIORITY_RESULT: TriageResult = {
  priority: 'critical',
  category: 'infrastructure',
  suggestedAgents: ['log_analyst'],
  summary: 'Critical CPU spike detected',
  confidence: 0.95,
  investigationMode: 'orchestrator',
};

function createMockIncident(overrides?: Partial<Incident>): Incident {
  return {
    incidentId: incidentId('inc-123'),
    tenantId: tenantId('tenant-1'),
    title: 'Test Incident',
    description: 'Test description',
    severity: 'low',
    status: 'open',
    sourceProvider: 'datadog',
    sourceAlertId: 'dd-alert-456',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockIncidentRepo(): IIncidentRepository {
  const base = createMockIncident();
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(async (_t, _i, data) => ({ ...base, ...data }) as Incident),
    updateStatus: vi.fn(async (_t, _i, status) => ({ ...base, status, resolvedAt: status === 'resolved' ? new Date().toISOString() : undefined }) as Incident),
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

function createLLMClient(result: TriageResult): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue({
      content: result,
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.001,
    }),
  };
}

function createMockMessageQueue(): MessageQueue {
  return {
    send: vi.fn(async () => {}),
  };
}

describe('TriageIncidentUseCase — terminal (low/medium/info) path', () => {
  let incidentRepo: IIncidentRepository;
  let evidenceRepo: IEvidenceRepository;
  let eventBus: EventBus;
  let messageQueue: MessageQueue;
  let updateIncidentStatus: UpdateIncidentStatusUseCase;

  beforeEach(() => {
    incidentRepo = createMockIncidentRepo();
    evidenceRepo = createMockEvidenceRepo();
    eventBus = new EventBus();
    messageQueue = createMockMessageQueue();
    updateIncidentStatus = new UpdateIncidentStatusUseCase(incidentRepo, eventBus);
  });

  it('should resolve incident with rootCause when LLM returns low priority', async () => {
    // Seed: incident starts as 'open', but after triage use case sets it to 'triaging'
    // the UpdateIncidentStatusUseCase.execute must see it as 'triaging'.
    // We simulate: findById returns 'open' first (for the main execute check),
    // then 'triaging' (for the UpdateIncidentStatusUseCase internal findById call).
    vi.mocked(incidentRepo.findById)
      .mockResolvedValueOnce(createMockIncident({ status: 'open' }))
      .mockResolvedValueOnce(createMockIncident({ status: 'triaging' }));

    const llmClient = createLLMClient(LOW_PRIORITY_RESULT);
    const useCase = new TriageIncidentUseCase({
      incidentRepo,
      evidenceRepo,
      eventBus,
      llmClient,
      messageQueue,
      investigationQueueUrl: INVESTIGATION_QUEUE_URL,
      minInvestigationSeverity: 'high',
      updateIncidentStatus,
    });

    const statusChangedEvents: unknown[] = [];
    eventBus.subscribe('incident.status_changed', (e) => { statusChangedEvents.push(e); });

    await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    // rootCause must be written to the incident repo
    expect(incidentRepo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      expect.objectContaining({ rootCause: 'manual test' }),
    );

    // updateStatus must have been called with 'resolved'
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      'resolved',
      expect.any(String), // resolvedAt
    );

    // messageQueue.send must NOT be called
    expect(messageQueue.send).not.toHaveBeenCalled();

    // eventBus must have published incident.status_changed with triaging → resolved
    const resolvedEvent = statusChangedEvents.find(
      (e: any) => e.payload?.from === 'triaging' && e.payload?.to === 'resolved',
    );
    expect(resolvedEvent).toBeDefined();
  });

  it('should dispatch worker and NOT resolve when LLM returns critical priority', async () => {
    vi.mocked(incidentRepo.findById)
      .mockResolvedValueOnce(createMockIncident({ status: 'open' }));

    const llmClient = createLLMClient(CRITICAL_PRIORITY_RESULT);
    const useCase = new TriageIncidentUseCase({
      incidentRepo,
      evidenceRepo,
      eventBus,
      llmClient,
      messageQueue,
      investigationQueueUrl: INVESTIGATION_QUEUE_URL,
      minInvestigationSeverity: 'high',
      updateIncidentStatus,
    });

    await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    // messageQueue.send IS called for high-severity
    expect(messageQueue.send).toHaveBeenCalledWith(
      INVESTIGATION_QUEUE_URL,
      expect.objectContaining({
        incidentId: 'inc-123',
        tenantId: 'tenant-1',
        severity: 'critical',
        investigationMode: 'orchestrator',
      }),
    );

    // updateStatus should NOT have been called with 'resolved'
    const resolvedCalls = vi.mocked(incidentRepo.updateStatus).mock.calls.filter(
      (call) => call[2] === 'resolved',
    );
    expect(resolvedCalls).toHaveLength(0);

    // rootCause should NOT be written in the high-severity path
    const rootCauseCalls = vi.mocked(incidentRepo.update).mock.calls.filter(
      (call) => (call[2] as any)?.rootCause !== undefined,
    );
    expect(rootCauseCalls).toHaveLength(0);
  });
});
