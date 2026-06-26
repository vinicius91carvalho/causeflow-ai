import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTenantUseCase } from '../../../../src/modules/tenant/application/create-tenant.usecase.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { TenantSlugConflictError } from '../../../../src/modules/tenant/domain/tenant.errors.js';

function createMockRepo(): ITenantRepository {
  return {
    create: vi.fn(async (t: Tenant) => t),
    findById: vi.fn(async () => null),
    findBySlug: vi.fn(async () => null),
    findByCustomDomain: vi.fn(),
    update: vi.fn(),
    listByOwner: vi.fn(),
  };
}

describe('CreateTenantUseCase', () => {
  let repo: ITenantRepository;
  let eventBus: EventBus;
  let useCase: CreateTenantUseCase;

  beforeEach(() => {
    repo = createMockRepo();
    eventBus = new EventBus();
    useCase = new CreateTenantUseCase(repo, eventBus);
  });

  it('should create a tenant with default values', async () => {
    const tenant = await useCase.execute({
      name: 'Acme Corp',
      slug: 'acme-corp',
      ownerEmail: 'admin@acme.com',
    });

    expect(tenant.name).toBe('Acme Corp');
    expect(tenant.slug).toBe('acme-corp');
    expect(tenant.plan).toBe('starter');
    expect(tenant.status).toBe('active');
    expect(tenant.settings.autoRemediation).toBe(false);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('should create a tenant with custom plan', async () => {
    const tenant = await useCase.execute({
      name: 'Pro Corp',
      slug: 'pro-corp',
      ownerEmail: 'admin@pro.com',
      plan: 'pro',
    });

    expect(tenant.plan).toBe('pro');
  });

  it('should throw conflict error for duplicate slug', async () => {
    vi.mocked(repo.findBySlug).mockResolvedValueOnce({
      tenantId: 'existing',
    } as unknown as Tenant);

    await expect(
      useCase.execute({
        name: 'Duplicate',
        slug: 'existing-slug',
        ownerEmail: 'admin@dup.com',
      }),
    ).rejects.toThrow(TenantSlugConflictError);
  });

  it('should publish tenant.created event', async () => {
    const handler = vi.fn();
    eventBus.subscribe('tenant.created', handler);

    await useCase.execute({
      name: 'Event Test',
      slug: 'event-test',
      ownerEmail: 'admin@event.com',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'tenant.created',
      payload: expect.objectContaining({ slug: 'event-test', plan: 'starter' }),
    });
  });
});
