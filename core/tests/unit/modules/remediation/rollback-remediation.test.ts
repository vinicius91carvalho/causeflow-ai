import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RollbackRemediationUseCase } from '../../../../src/modules/remediation/application/rollback-remediation.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, remediationId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import { ConflictError } from '../../../../src/shared/domain/errors.js';

const completedRemediation: Remediation = {
  remediationId: remediationId('rem-source'),
  tenantId: tenantId('tenant-1'),
  incidentId: incidentId('inc-1'),
  status: 'completed',
  description: 'Fix memory leak',
  rootCause: 'Memory leak',
  steps: [
    {
      stepIndex: 0,
      action: 'scale_horizontal',
      label: 'Scale Up',
      description: 'Increase instances',
      riskLevel: 'medium',
      automated: true,
      params: { service: 'order-service', desiredCount: 5 },
      status: 'succeeded',
      beforeState: { desiredCount: 3 },
      afterState: { desiredCount: 5 },
    },
    {
      stepIndex: 1,
      action: 'restart_service',
      label: 'Restart',
      description: 'Rolling restart',
      riskLevel: 'low',
      automated: true,
      params: { service: 'order-service' },
      status: 'succeeded',
      beforeState: { status: 'running' },
      afterState: { status: 'restarted' },
    },
  ],
  proposedBy: 'admin@test.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createMockRemediationRepo(): IRemediationRepository {
  return {
    create: vi.fn(async (remediation: Remediation) => remediation),
    findById: vi.fn(async () => ({ ...completedRemediation, steps: completedRemediation.steps.map((s) => ({ ...s })) })),
    findByIncident: vi.fn(),
    update: vi.fn(),
  };
}

describe('RollbackRemediationUseCase', () => {
  let remediationRepo: IRemediationRepository;
  let eventBus: EventBus;
  let useCase: RollbackRemediationUseCase;

  beforeEach(() => {
    remediationRepo = createMockRemediationRepo();
    eventBus = new EventBus();
    useCase = new RollbackRemediationUseCase(remediationRepo, eventBus);
  });

  it('creates a proposed rollback remediation with inverse steps', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-source'),
      actorEmail: 'admin@test.com',
    });

    expect(result.status).toBe('proposed');
    expect(result.rollbackOf).toBe('rem-source');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.label).toMatch(/^Rollback:/);
    const scaleRollback = result.steps.find((s) => s.action === 'scale_horizontal');
    expect(scaleRollback?.params).toMatchObject({ desiredCount: 3, service: 'order-service' });
    expect(remediationRepo.create).toHaveBeenCalledOnce();
  });

  it('publishes remediation.proposed with rollbackOf', async () => {
    const handler = vi.fn();
    eventBus.subscribe('remediation.proposed', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-source'),
      actorEmail: 'admin@test.com',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'remediation.proposed',
      payload: expect.objectContaining({
        rollbackOf: 'rem-source',
      }),
    });
  });

  it('throws NotFoundError when source remediation does not exist', async () => {
    vi.mocked(remediationRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-missing'),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when source remediation is not completed', async () => {
    vi.mocked(remediationRepo.findById).mockResolvedValueOnce({ ...completedRemediation, status: 'approved' });

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-source'),
      }),
    ).rejects.toThrow(ConflictError);
  });
});
