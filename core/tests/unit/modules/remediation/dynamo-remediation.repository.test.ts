import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantId, incidentId, remediationId } from '../../../../src/shared/domain/value-objects.js';

const mockEntity = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  query: {
    byIncident: vi.fn(),
  },
  patch: vi.fn(),
}));

vi.mock('../../../../src/shared/infra/db/entities/RemediationEntity.js', () => ({
  RemediationEntity: mockEntity,
}));

import { DynamoRemediationRepository } from '../../../../src/modules/remediation/infra/dynamo-remediation.repository.js';

const sampleRemediationData = {
  remediationId: 'rem-1',
  tenantId: 'tenant-1',
  incidentId: 'inc-1',
  status: 'proposed',
  description: 'Fix the issue',
  rootCause: 'Memory leak',
  steps: [{ stepIndex: 0, action: 'restart', label: 'Restart service', description: 'Restarts the affected service', riskLevel: 'low' as const, automated: true, params: {}, status: 'pending' as const }],
  proposedBy: 'system',
  approvedBy: undefined,
  rejectedBy: undefined,
  rejectionReason: undefined,
  completedAt: undefined,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('DynamoRemediationRepository', () => {
  let repo: DynamoRemediationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoRemediationRepository();
  });

  it('create() should call RemediationEntity.create and return domain object', async () => {
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleRemediationData }),
    });

    const remediation = {
      remediationId: remediationId('rem-1'),
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-1'),
      status: 'proposed' as const,
      description: 'Fix the issue',
      rootCause: 'Memory leak',
      steps: [{ stepIndex: 0, action: 'restart', label: 'Restart service', description: 'Restarts the affected service', riskLevel: 'low' as const, automated: true, params: {}, status: 'pending' as const }],
      proposedBy: 'system',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = await repo.create(remediation);

    expect(mockEntity.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      remediationId: 'rem-1',
      incidentId: 'inc-1',
      status: 'proposed',
      description: 'Fix the issue',
      rootCause: 'Memory leak',
      steps: [{ stepIndex: 0, action: 'restart', label: 'Restart service', description: 'Restarts the affected service', riskLevel: 'low' as const, automated: true, params: {}, status: 'pending' as const }],
      proposedBy: 'system',
    });
    expect(result.remediationId).toBe('rem-1');
    expect(result.status).toBe('proposed');
    expect(result.rootCause).toBe('Memory leak');
  });

  it('findById() should return domain object when found', async () => {
    mockEntity.get.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleRemediationData }),
    });

    const result = await repo.findById(tenantId('tenant-1'), remediationId('rem-1'));

    expect(mockEntity.get).toHaveBeenCalledWith({ tenantId: 'tenant-1', remediationId: 'rem-1' });
    expect(result).not.toBeNull();
    expect(result!.remediationId).toBe('rem-1');
    expect(result!.description).toBe('Fix the issue');
    expect(result!.steps).toHaveLength(1);
  });

  it('findById() should return null when not found', async () => {
    mockEntity.get.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: null }),
    });

    const result = await repo.findById(tenantId('tenant-1'), remediationId('nonexistent'));

    expect(mockEntity.get).toHaveBeenCalledWith({ tenantId: 'tenant-1', remediationId: 'nonexistent' });
    expect(result).toBeNull();
  });

  it('findByIncident() should call query.byIncident and return array', async () => {
    mockEntity.query.byIncident.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [sampleRemediationData] }),
    });

    const result = await repo.findByIncident(tenantId('tenant-1'), incidentId('inc-1'));

    expect(mockEntity.query.byIncident).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      incidentId: 'inc-1',
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.incidentId).toBe('inc-1');
    expect(result[0]!.proposedBy).toBe('system');
  });

  it('update() should call patch().set().go() and return updated domain object', async () => {
    const updatedData = { ...sampleRemediationData, status: 'approved', approvedBy: 'admin@acme.com' };
    const mockSetGo = vi.fn().mockResolvedValue({ data: updatedData });
    const mockSet = vi.fn().mockReturnValue({ go: mockSetGo });
    mockEntity.patch.mockReturnValue({ set: mockSet });

    const result = await repo.update(tenantId('tenant-1'), remediationId('rem-1'), {
      status: 'approved' as any,
      approvedBy: 'admin@acme.com',
    });

    expect(mockEntity.patch).toHaveBeenCalledWith({ tenantId: 'tenant-1', remediationId: 'rem-1' });
    expect(mockSet).toHaveBeenCalledWith({ status: 'approved', approvedBy: 'admin@acme.com' });
    expect(mockSetGo).toHaveBeenCalledWith({ response: 'all_new' });
    expect(result.status).toBe('approved');
    expect(result.approvedBy).toBe('admin@acme.com');
  });
});
