import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetRemediationUseCase } from '../../../../src/modules/remediation/application/get-remediation.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import { tenantId, remediationId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';

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

function createMockRepo(): IRemediationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => ({ ...mockRemediation })),
    findByIncident: vi.fn(async () => [{ ...mockRemediation }]),
    update: vi.fn(),
  };
}

describe('GetRemediationUseCase', () => {
  let repo: IRemediationRepository;
  let useCase: GetRemediationUseCase;

  beforeEach(() => {
    repo = createMockRepo();
    useCase = new GetRemediationUseCase(repo);
  });

  it('should get remediation by ID', async () => {
    const result = await useCase.getById(tenantId('tenant-1'), remediationId('rem-1'));

    expect(result.remediationId).toBe('rem-1');
    expect(result.status).toBe('proposed');
    expect(repo.findById).toHaveBeenCalledWith(tenantId('tenant-1'), remediationId('rem-1'));
  });

  it('should throw NotFoundError when remediation not found', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.getById(tenantId('tenant-1'), remediationId('rem-999')),
    ).rejects.toThrow(NotFoundError);
  });

  it('should list remediations by incident', async () => {
    const results = await useCase.listByIncident(tenantId('tenant-1'), incidentId('inc-1'));

    expect(results).toHaveLength(1);
    expect(results[0]?.incidentId).toBe('inc-1');
    expect(repo.findByIncident).toHaveBeenCalledWith(tenantId('tenant-1'), incidentId('inc-1'));
  });

  it('should return empty array when no remediations for incident', async () => {
    vi.mocked(repo.findByIncident).mockResolvedValueOnce([]);

    const results = await useCase.listByIncident(tenantId('tenant-1'), incidentId('inc-999'));

    expect(results).toHaveLength(0);
  });
});
