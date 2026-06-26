import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListPendingApprovalsUseCase } from '../../../../src/modules/notification/application/list-pending-approvals.usecase.js';
import type { IApprovalRepository } from '../../../../src/modules/notification/domain/approval.repository.js';
import type { PendingApproval } from '../../../../src/modules/notification/domain/approval.entity.js';
import {
  tenantId,
  approvalId,
  notificationId,
  incidentId,
  remediationId,
} from '../../../../src/shared/domain/value-objects.js';

function createApproval(id: string, expiresAt: string): PendingApproval {
  return {
    approvalId: approvalId(id),
    tenantId: tenantId('tenant-1'),
    notificationId: notificationId('notif-1'),
    incidentId: incidentId('inc-1'),
    remediationId: remediationId('rem-1'),
    title: 'Approve remediation',
    description: 'Restart service api-gateway',
    actions: [
      { label: 'Approve', value: 'approve', style: 'primary' },
      { label: 'Reject', value: 'reject', style: 'danger' },
    ],
    status: 'pending',
    timeoutMinutes: 30,
    expiresAt,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  };
}

function createMockRepo(): IApprovalRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findPendingByTenant: vi.fn(),
    update: vi.fn(),
  };
}

describe('ListPendingApprovalsUseCase', () => {
  let repo: IApprovalRepository;
  let useCase: ListPendingApprovalsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    useCase = new ListPendingApprovalsUseCase(repo);
  });

  it('should return non-expired pending approvals', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const approvals = [
      createApproval('appr-1', futureDate),
      createApproval('appr-2', futureDate),
    ];
    vi.mocked(repo.findPendingByTenant).mockResolvedValueOnce(approvals);

    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result).toHaveLength(2);
    expect(repo.findPendingByTenant).toHaveBeenCalledWith(tenantId('tenant-1'));
  });

  it('should filter out expired approvals', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const approvals = [
      createApproval('appr-1', futureDate),
      createApproval('appr-2', pastDate),
      createApproval('appr-3', pastDate),
    ];
    vi.mocked(repo.findPendingByTenant).mockResolvedValueOnce(approvals);

    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result).toHaveLength(1);
    expect(result[0]!.approvalId).toBe('appr-1');
  });

  it('should return empty array when all approvals are expired', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const approvals = [
      createApproval('appr-1', pastDate),
      createApproval('appr-2', pastDate),
    ];
    vi.mocked(repo.findPendingByTenant).mockResolvedValueOnce(approvals);

    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result).toHaveLength(0);
  });

  it('should return empty array when no pending approvals exist', async () => {
    vi.mocked(repo.findPendingByTenant).mockResolvedValueOnce([]);

    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result).toHaveLength(0);
  });
});
