import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddInvestigationContextUseCase } from '../../../../src/modules/investigation/application/add-investigation-context.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

function createMockIncidentRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      incidentId: incidentId('inc-1'),
      tenantId: tenantId('tenant-1'),
      title: 'High CPU',
      description: 'CPU usage at 95%',
      severity: 'critical',
      status: 'investigating',
      sourceProvider: 'datadog',
      sourceAlertId: 'dd-1',
      assignedAgents: ['log_analyst', 'metric_analyst'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }),
    findBySourceAlert: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateStatus: vi.fn().mockResolvedValue({}),
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

function createMockMessageQueue() {
  return { send: vi.fn().mockResolvedValue(undefined), receive: vi.fn(), deleteMessage: vi.fn() };
}

describe('AddInvestigationContextUseCase', () => {
  let incidentRepo: IIncidentRepository;
  let evidenceRepo: IEvidenceRepository;
  let eventBus: EventBus;
  let messageQueue: ReturnType<typeof createMockMessageQueue>;
  let useCase: AddInvestigationContextUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    incidentRepo = createMockIncidentRepo();
    evidenceRepo = createMockEvidenceRepo();
    eventBus = new EventBus();
    messageQueue = createMockMessageQueue();
    useCase = new AddInvestigationContextUseCase({
      incidentRepo,
      evidenceRepo,
      eventBus,
      messageQueue,
      investigationQueueUrl: 'http://investigation-queue',
    });
  });

  it('should save evidence with user context', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      context: 'We deployed version 2.3.1 right before this started',
      addedBy: 'admin@test.com',
    });

    expect(evidenceRepo.create).toHaveBeenCalledOnce();
    const evidence = vi.mocked(evidenceRepo.create).mock.calls[0]![0];
    expect(evidence.agentRole).toBe('operator');
    expect(evidence.evidenceType).toBe('user_context');
    expect(evidence.content).toBe('We deployed version 2.3.1 right before this started');
    expect(result.evidenceId).toBeDefined();
  });

  it('should append context to incident description', async () => {
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      context: 'Additional context here',
      addedBy: 'admin@test.com',
    });

    expect(incidentRepo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      expect.objectContaining({
        description: expect.stringContaining('[Operator Context] Additional context here'),
      }),
    );
  });

  it('reinvestigate=true should reset status and enqueue', async () => {
    // Reinvestigation is only allowed from non-active statuses (triaging, awaiting_approval,
    // resolved, closed) — never from 'investigating' where a worker is running.
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce({
      incidentId: incidentId('inc-1'),
      tenantId: tenantId('tenant-1'),
      title: 'High CPU',
      description: 'CPU usage at 95%',
      severity: 'critical',
      status: 'triaging',
      sourceProvider: 'datadog',
      sourceAlertId: 'dd-1',
      assignedAgents: ['log_analyst', 'metric_analyst'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });

    const handler = vi.fn();
    eventBus.subscribe('incident.status_changed', handler);

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      context: 'Try looking at the connection pool settings',
      addedBy: 'admin@test.com',
      reinvestigate: true,
    });

    expect(result.reinvestigationTriggered).toBe(true);
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'triaging',
    );
    expect(messageQueue.send).toHaveBeenCalledWith(
      'http://investigation-queue',
      expect.objectContaining({ incidentId: 'inc-1' }),
    );
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0].payload).toMatchObject({
      from: 'triaging',
      to: 'triaging',
    });
  });

  it('reinvestigate=false should not reinvestigate', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      context: 'Just adding some extra info',
      addedBy: 'admin@test.com',
      reinvestigate: false,
    });

    expect(result.reinvestigationTriggered).toBe(false);
    expect(incidentRepo.updateStatus).not.toHaveBeenCalled();
    expect(messageQueue.send).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when incident not found', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-999'),
        context: 'Some context for a non-existent incident',
        addedBy: 'admin@test.com',
      }),
    ).rejects.toThrow('Incident not found');
  });

  it('should reject context shorter than 5 chars', async () => {
    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-1'),
        context: 'Hi',
        addedBy: 'admin@test.com',
      }),
    ).rejects.toThrow('Context must be at least 5 characters');
  });
});
