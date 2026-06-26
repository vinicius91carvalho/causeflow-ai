import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkNotificationReadUseCase } from '../../../../src/modules/notification/application/mark-notification-read.usecase.js';
import type { INotificationRepository } from '../../../../src/modules/notification/domain/notification.repository.js';
import type { Notification } from '../../../../src/modules/notification/domain/notification.entity.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';
import { tenantId, notificationId } from '../../../../src/shared/domain/value-objects.js';

function createNotification(overrides?: Partial<Notification>): Notification {
  return {
    notificationId: notificationId('notif-1'),
    tenantId: tenantId('tenant-1'),
    channelId: 'channel-1',
    type: 'message',
    title: 'Alert fired',
    text: 'CPU usage exceeded threshold',
    status: 'delivered',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    ...overrides,
  };
}

function createMockRepo(): INotificationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    listByTenant: vi.fn(),
    update: vi.fn(async (_t, _n, updates) => ({
      ...createNotification(),
      ...updates,
    }) as Notification),
  };
}

describe('MarkNotificationReadUseCase', () => {
  let repo: INotificationRepository;
  let useCase: MarkNotificationReadUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    useCase = new MarkNotificationReadUseCase(repo);
  });

  it('should mark notification as read', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(createNotification());

    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      notificationId: notificationId('notif-1'),
    });

    expect(result.status).toBe('read');
    expect(repo.findById).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      notificationId('notif-1'),
    );
    expect(repo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      notificationId('notif-1'),
      expect.objectContaining({ status: 'read' }),
    );
  });

  it('should pass updatedAt timestamp to update', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(createNotification());

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      notificationId: notificationId('notif-1'),
    });

    const updateCall = vi.mocked(repo.update).mock.calls[0]!;
    const updates = updateCall[2];
    expect(updates.updatedAt).toBeDefined();
    expect(new Date(updates.updatedAt ?? '').getTime()).toBeGreaterThan(0);
  });

  it('should throw NotFoundError when notification does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        notificationId: notificationId('notif-999'),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should not call update when notification is not found', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null);

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      notificationId: notificationId('notif-999'),
    }).catch(() => {});

    expect(repo.update).not.toHaveBeenCalled();
  });
});
