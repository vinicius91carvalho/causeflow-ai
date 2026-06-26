import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListNotificationsUseCase } from '../../../../src/modules/notification/application/list-notifications.usecase.js';
import type { INotificationRepository } from '../../../../src/modules/notification/domain/notification.repository.js';
import type { Notification } from '../../../../src/modules/notification/domain/notification.entity.js';
import { tenantId, notificationId } from '../../../../src/shared/domain/value-objects.js';

function createNotification(id = 'notif-1'): Notification {
  return {
    notificationId: notificationId(id),
    tenantId: tenantId('tenant-1'),
    channelId: 'channel-1',
    type: 'message',
    title: 'Alert fired',
    text: 'CPU usage exceeded threshold',
    status: 'delivered',
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  };
}

function createMockRepo(): INotificationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    listByTenant: vi.fn(),
    update: vi.fn(),
  };
}

describe('ListNotificationsUseCase', () => {
  let repo: INotificationRepository;
  let useCase: ListNotificationsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    useCase = new ListNotificationsUseCase(repo);
  });

  it('should return paginated notification results', async () => {
    const notifications = [createNotification('notif-1'), createNotification('notif-2')];
    vi.mocked(repo.listByTenant).mockResolvedValueOnce({
      items: notifications,
      cursor: 'next-cursor',
    });

    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result.items).toHaveLength(2);
    expect(result.cursor).toBe('next-cursor');
  });

  it('should pass cursor to the repository', async () => {
    vi.mocked(repo.listByTenant).mockResolvedValueOnce({ items: [], cursor: undefined });

    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      cursor: 'page-2-cursor',
      limit: 10,
    });

    expect(repo.listByTenant).toHaveBeenCalledWith(tenantId('tenant-1'), {
      cursor: 'page-2-cursor',
      limit: 10,
    });
  });

  it('should use default limit of 20 when not provided', async () => {
    vi.mocked(repo.listByTenant).mockResolvedValueOnce({ items: [], cursor: undefined });

    await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(repo.listByTenant).toHaveBeenCalledWith(tenantId('tenant-1'), {
      cursor: undefined,
      limit: 20,
    });
  });

  it('should return empty list when no notifications exist', async () => {
    vi.mocked(repo.listByTenant).mockResolvedValueOnce({ items: [] });

    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result.items).toHaveLength(0);
    expect(result.cursor).toBeUndefined();
  });
});
