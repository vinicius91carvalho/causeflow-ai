import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApproveRemediationUseCase } from '../../../../src/modules/remediation/application/approve-remediation.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, remediationId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError, ConflictError } from '../../../../src/shared/domain/errors.js';

const mockRemediation: Remediation = {
  remediationId: remediationId('rem-1'),
  tenantId: tenantId('tenant-1'),
  incidentId: 'inc-1' as never,
  status: 'proposed',
  description: 'Fix memory leak',
  rootCause: 'Memory leak',
  steps: [
    {
      stepIndex: 0,
      action: 'restart',
      label: 'Restart service',
      description: 'Restarts the affected service',
      riskLevel: 'low',
      automated: true,
      params: {},
      status: 'pending',
    },
  ],
  proposedBy: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createMockRepo(): IRemediationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => ({ ...mockRemediation })),
    findByIncident: vi.fn(),
    update: vi.fn(
      async (_t, _r, data: Partial<Remediation>) =>
        ({ ...mockRemediation, ...data }) as Remediation,
    ),
  };
}

describe('ApproveRemediationUseCase', () => {
  let repo: IRemediationRepository;
  let eventBus: EventBus;
  let useCase: ApproveRemediationUseCase;

  beforeEach(() => {
    repo = createMockRepo();
    eventBus = new EventBus();
    useCase = new ApproveRemediationUseCase(repo, eventBus);
  });

  it('should approve remediation and set status to approved', async () => {
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
      approvedBy: 'admin@test.com',
    });

    expect(result.status).toBe('approved');
    expect(result.approvedBy).toBe('admin@test.com');
    expect(repo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      remediationId('rem-1'),
      expect.objectContaining({ status: 'approved', approvedBy: 'admin@test.com' }),
    );
  });

  it('should publish remediation.approved event', async () => {
    const handler = vi.fn();
    eventBus.subscribe('remediation.approved', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      remediationId: remediationId('rem-1'),
      approvedBy: 'admin@test.com',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'remediation.approved',
      payload: expect.objectContaining({
        remediationId: 'rem-1',
        approvedBy: 'admin@test.com',
      }),
    });
  });

  it('should throw NotFoundError when remediation does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-999'),
        approvedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError when status is not proposed', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...mockRemediation, status: 'executing' });

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        remediationId: remediationId('rem-1'),
        approvedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(ConflictError);
  });
});
