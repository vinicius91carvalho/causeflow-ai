import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecuteRemediationUseCase } from '../../../../src/modules/remediation/application/execute-remediation.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import {
  tenantId,
  remediationId,
  incidentId,
} from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import { RemediationNotApprovedError } from '../../../../src/modules/remediation/domain/remediation.errors.js';

const mockRemediation: Remediation = {
  remediationId: remediationId('rem-1'),
  tenantId: tenantId('tenant-1'),
  incidentId: incidentId('inc-1'),
  status: 'approved',
  description: 'Fix memory leak',
  rootCause: 'Memory leak',
  steps: [
    {
      stepIndex: 0,
      action: 'restart_service',
      label: 'Restart service',
      description: 'Restarts the affected service pod',
      riskLevel: 'low',
      automated: true,
      params: {},
      status: 'pending',
    },
    {
      stepIndex: 1,
      action: 'scale_up',
      label: 'Scale up replicas',
      description: 'Increases replica count to handle load',
      riskLevel: 'medium',
      automated: true,
      params: { replicas: 3 },
      status: 'pending',
    },
  ],
  proposedBy: 'system',
  approvedBy: 'admin@test.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createMockRemediationRepo(): IRemediationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => ({
      ...mockRemediation,
      steps: mockRemediation.steps.map((s) => ({ ...s })),
    })),
    findByIncident: vi.fn(),
    update: vi.fn(
      async (_t, _r, data: Partial<Remediation>) =>
        ({ ...mockRemediation, ...data }) as Remediation,
    ),
  };
}

function createMockIncidentRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

function createMockCloudProvider(): CloudProvider {
  return {
    name: 'mock',
    queryLogs: vi.fn(),
    queryMetrics: vi.fn(),
    describeService: vi.fn(),
    executeAction: vi.fn(async () => ({
      success: true,
      output: 'Action executed',
      beforeState: { desiredCount: 3 },
      afterState: { desiredCount: 5 },
    })),
    testConnection: vi.fn(),
  };
}

describe('ExecuteRemediationUseCase', () => {
  let remediationRepo: IRemediationRepository;
  let incidentRepo: IIncidentRepository;
  let eventBus: EventBus;
  let cloudProvider: CloudProvider;
  let useCase: ExecuteRemediationUseCase;

  beforeEach(() => {
    remediationRepo = createMockRemediationRepo();
    incidentRepo = createMockIncidentRepo();
    eventBus = new EventBus();
    cloudProvider = createMockCloudProvider();
    useCase = new ExecuteRemediationUseCase(remediationRepo, incidentRepo, eventBus, cloudProvider);
  });

  it('should execute all steps successfully', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
    });

    expect(result.status).toBe('completed');
    expect(result.steps[0]?.status).toBe('succeeded');
    expect(result.steps[0]?.beforeState).toEqual({ desiredCount: 3 });
    expect(result.steps[0]?.afterState).toEqual({ desiredCount: 5 });
    expect(cloudProvider.executeAction).toHaveBeenCalledTimes(2);
  });

  it('should call CloudProvider.executeAction for each step', async () => {
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
    });

    expect(cloudProvider.executeAction).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'stub' }),
      expect.objectContaining({ action: 'restart_service' }),
    );
    expect(cloudProvider.executeAction).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'stub' }),
      expect.objectContaining({ action: 'scale_up' }),
    );
  });

  it('should mark remaining steps as skipped when one fails', async () => {
    vi.mocked(cloudProvider.executeAction).mockResolvedValueOnce({
      success: false,
      output: 'Failed',
    });

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
    });

    expect(result.status).toBe('failed');
    expect(result.steps[0]?.status).toBe('failed');
    expect(result.steps[1]?.status).toBe('skipped');
    expect(cloudProvider.executeAction).toHaveBeenCalledTimes(1);
  });

  it('should resolve incident on success', async () => {
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
    });

    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'remediating',
    );
    // Second call is for resolved
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'resolved',
      expect.any(String),
    );
  });

  it('should not resolve incident on failure', async () => {
    vi.mocked(cloudProvider.executeAction).mockResolvedValueOnce({
      success: false,
      output: 'Error',
    });

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
    });

    // Should call updateStatus for 'remediating' but NOT for 'resolved'
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'remediating',
    );
    expect(incidentRepo.updateStatus).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'resolved',
      expect.anything(),
    );
  });

  it('should publish remediation.executed event', async () => {
    const handler = vi.fn();
    eventBus.subscribe('remediation.executed', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'remediation.executed',
      payload: expect.objectContaining({
        remediationId: 'rem-1',
        stepsCompleted: 2,
        totalSteps: 2,
      }),
    });
  });

  it('should throw NotFoundError when remediation does not exist', async () => {
    vi.mocked(remediationRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-999'),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw RemediationNotApprovedError when status is not approved', async () => {
    vi.mocked(remediationRepo.findById).mockResolvedValueOnce({
      ...mockRemediation,
      status: 'proposed',
    });

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-1'),
      }),
    ).rejects.toThrow(RemediationNotApprovedError);
  });
});
