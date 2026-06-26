import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RejectRemediationUseCase } from '../../../../src/modules/remediation/application/reject-remediation.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, remediationId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import { RemediationNotProposedError } from '../../../../src/modules/remediation/domain/remediation.errors.js';

const mockRemediation: Remediation = {
  remediationId: remediationId('rem-1'),
  tenantId: tenantId('tenant-1'),
  incidentId: incidentId('inc-1'),
  status: 'proposed',
  description: 'Fix memory leak',
  rootCause: 'Memory leak',
  steps: [{ stepIndex: 0, action: 'restart', label: 'Restart service', description: 'Restarts the affected service', riskLevel: 'low', automated: true, params: {}, status: 'pending' }],
  proposedBy: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createMockRemediationRepo(): IRemediationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => ({ ...mockRemediation })),
    findByIncident: vi.fn(),
    update: vi.fn(async (_t, _r, data: Partial<Remediation>) => ({ ...mockRemediation, ...data }) as Remediation),
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

describe('RejectRemediationUseCase', () => {
  let remediationRepo: IRemediationRepository;
  let incidentRepo: IIncidentRepository;
  let eventBus: EventBus;
  let useCase: RejectRemediationUseCase;

  beforeEach(() => {
    remediationRepo = createMockRemediationRepo();
    incidentRepo = createMockIncidentRepo();
    eventBus = new EventBus();
    useCase = new RejectRemediationUseCase(remediationRepo, incidentRepo, eventBus);
  });

  it('should reject remediation and set status to rejected', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
      rejectedBy: 'admin@test.com',
      reason: 'Too risky',
    });

    expect(result.status).toBe('rejected');
    expect(result.rejectedBy).toBe('admin@test.com');
    expect(result.rejectionReason).toBe('Too risky');
  });

  it('should transition incident back to investigating', async () => {
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
      rejectedBy: 'admin@test.com',
    });

    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'investigating',
    );
  });

  it('should publish remediation.rejected event', async () => {
    const handler = vi.fn();
    eventBus.subscribe('remediation.rejected', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
      rejectedBy: 'admin@test.com',
      reason: 'Not needed',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'remediation.rejected',
      payload: expect.objectContaining({
        remediationId: 'rem-1',
        rejectedBy: 'admin@test.com',
        reason: 'Not needed',
      }),
    });
  });

  it('should throw NotFoundError when remediation does not exist', async () => {
    vi.mocked(remediationRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-999'),
        rejectedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw RemediationNotProposedError when status is not proposed', async () => {
    vi.mocked(remediationRepo.findById).mockResolvedValueOnce({ ...mockRemediation, status: 'approved' });

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-1'),
        rejectedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(RemediationNotProposedError);
  });
});
