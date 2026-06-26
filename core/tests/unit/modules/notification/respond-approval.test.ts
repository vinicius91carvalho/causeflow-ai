import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RespondApprovalUseCase } from '../../../../src/modules/notification/application/respond-approval.usecase.js';
import type { ApprovalCallbacks } from '../../../../src/modules/notification/application/respond-approval.usecase.js';
import type { IApprovalRepository } from '../../../../src/modules/notification/domain/approval.repository.js';
import type { PendingApproval } from '../../../../src/modules/notification/domain/approval.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { NotFoundError, ValidationError } from '../../../../src/shared/domain/errors.js';
import {
  tenantId,
  approvalId,
  notificationId,
  incidentId,
  remediationId,
} from '../../../../src/shared/domain/value-objects.js';

function createPendingApproval(overrides?: Partial<PendingApproval>): PendingApproval {
  const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    approvalId: approvalId('appr-1'),
    tenantId: tenantId('tenant-1'),
    notificationId: notificationId('notif-1'),
    incidentId: incidentId('inc-1'),
    remediationId: remediationId('rem-1'),
    title: 'Approve remediation',
    description: 'Restart api-gateway',
    actions: [
      { label: 'Approve', value: 'approve', style: 'primary' },
      { label: 'Reject', value: 'reject', style: 'danger' },
    ],
    status: 'pending',
    timeoutMinutes: 30,
    expiresAt: futureDate,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    ...overrides,
  };
}

function createMockRepo(): IApprovalRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findPendingByTenant: vi.fn(),
    update: vi.fn(async (_t, _a, updates) => ({
      ...createPendingApproval(),
      ...updates,
    }) as PendingApproval),
  };
}

describe('RespondApprovalUseCase', () => {
  let repo: IApprovalRepository;
  let eventBus: EventBus;
  let useCase: RespondApprovalUseCase;
  let callbacks: ApprovalCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    eventBus = new EventBus();
    callbacks = {
      onApprove: vi.fn(),
      onReject: vi.fn(),
    };
    useCase = new RespondApprovalUseCase(repo, eventBus, callbacks);
  });

  it('should approve and update status to approved', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(createPendingApproval());

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      approvalId: approvalId('appr-1'),
      action: 'approve',
      respondedBy: 'admin@test.com',
    });

    expect(result.status).toBe('approved');
    expect(result.respondedBy).toBe('admin@test.com');
    expect(result.selectedAction).toBe('approve');
    expect(repo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      approvalId('appr-1'),
      expect.objectContaining({
        status: 'approved',
        respondedBy: 'admin@test.com',
        selectedAction: 'approve',
      }),
    );
    expect(callbacks.onApprove).toHaveBeenCalledTimes(1);
    expect(callbacks.onReject).not.toHaveBeenCalled();
  });

  it('should reject and update status to rejected', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(createPendingApproval());

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      approvalId: approvalId('appr-1'),
      action: 'reject',
      respondedBy: 'admin@test.com',
    });

    expect(result.status).toBe('rejected');
    expect(result.selectedAction).toBe('reject');
    expect(callbacks.onReject).toHaveBeenCalledTimes(1);
    expect(callbacks.onApprove).not.toHaveBeenCalled();
  });

  it('should publish notification.approval_responded event', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(createPendingApproval());
    const handler = vi.fn();
    eventBus.subscribe('notification.approval_responded', handler);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      approvalId: approvalId('appr-1'),
      action: 'approve',
      respondedBy: 'admin@test.com',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'notification.approval_responded',
      payload: expect.objectContaining({
        approvalId: 'appr-1',
        remediationId: 'rem-1',
        action: 'approve',
        respondedBy: 'admin@test.com',
      }),
    });
  });

  it('should throw NotFoundError when approval does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        approvalId: approvalId('appr-999'),
        action: 'approve',
        respondedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError when approval already responded', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(
      createPendingApproval({ status: 'approved' }),
    );

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        approvalId: approvalId('appr-1'),
        action: 'approve',
        respondedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError when approval has expired', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    vi.mocked(repo.findById).mockResolvedValueOnce(
      createPendingApproval({ expiresAt: pastDate }),
    );

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        approvalId: approvalId('appr-1'),
        action: 'approve',
        respondedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError when action is invalid', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(createPendingApproval());

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        approvalId: approvalId('appr-1'),
        action: 'escalate',
        respondedBy: 'admin@test.com',
      }),
    ).rejects.toThrow(ValidationError);
  });
});
