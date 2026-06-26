import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateTenantUseCase } from '../../../../src/modules/tenant/application/update-tenant.usecase.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { TenantNotFoundError } from '../../../../src/modules/tenant/domain/tenant.errors.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

const baseTenant: Tenant = {
  tenantId: tenantId('tenant-1'),
  name: 'Acme Corp',
  slug: 'acme-corp',
  ownerEmail: 'admin@acme.com',
  plan: 'starter',
  status: 'active',
  settings: { maxIncidentsPerMonth: 50, autoRemediation: false, notificationChannels: [] },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function createMockRepo(): ITenantRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => baseTenant),
    findBySlug: vi.fn(),
    findByCustomDomain: vi.fn(),
    update: vi.fn(async (_id, data: Partial<Tenant>) => ({ ...baseTenant, ...data })),
    listByOwner: vi.fn(),
  };
}

describe('UpdateTenantUseCase', () => {
  let repo: ITenantRepository;
  let eventBus: EventBus;
  let useCase: UpdateTenantUseCase;

  beforeEach(() => {
    repo = createMockRepo();
    eventBus = new EventBus();
    useCase = new UpdateTenantUseCase(repo, eventBus);
  });

  it('should update tenant name', async () => {
    const result = await useCase.execute(tenantId('tenant-1'), { name: 'New Name' });

    expect(result.name).toBe('New Name');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('should throw TenantNotFoundError when not found', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute(tenantId('nonexistent'), { name: 'New' }),
    ).rejects.toThrow(TenantNotFoundError);
  });

  it('should publish tenant.updated event', async () => {
    const handler = vi.fn();
    eventBus.subscribe('tenant.updated', handler);

    await useCase.execute(tenantId('tenant-1'), { plan: 'pro' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'tenant.updated',
      payload: expect.objectContaining({ tenantId: 'tenant-1' }),
    });
  });

  it('should update tenant with chat provider settings', async () => {
    const chatSettings = {
      settings: {
        chatProvider: 'web_portal' as const,
      },
    };

    await useCase.execute(tenantId('tenant-1'), chatSettings);

    expect(repo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      expect.objectContaining({
        settings: expect.objectContaining({
          chatProvider: 'web_portal',
        }),
      }),
    );
  });
});
