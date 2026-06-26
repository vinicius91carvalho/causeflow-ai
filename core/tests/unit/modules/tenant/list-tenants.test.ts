import { describe, it, expect, vi } from 'vitest';
import { ListTenantsUseCase } from '../../../../src/modules/tenant/application/list-tenants.usecase.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';

describe('ListTenantsUseCase', () => {
  it('should list tenants for an owner', async () => {
    const tenants = [
      { tenantId: 't-1', name: 'Acme' },
      { tenantId: 't-2', name: 'Beta' },
    ] as Tenant[];

    const repo: ITenantRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByCustomDomain: vi.fn(),
      update: vi.fn(),
      listByOwner: vi.fn(async () => ({ items: tenants, cursor: undefined })),
    };

    const useCase = new ListTenantsUseCase(repo);
    const result = await useCase.execute({ ownerEmail: 'admin@acme.com' });

    expect(result.items).toHaveLength(2);
    expect(repo.listByOwner).toHaveBeenCalledWith('admin@acme.com', { limit: 20, cursor: undefined });
  });

  it('should use default limit of 20', async () => {
    const repo: ITenantRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByCustomDomain: vi.fn(),
      update: vi.fn(),
      listByOwner: vi.fn(async () => ({ items: [], cursor: undefined })),
    };

    const useCase = new ListTenantsUseCase(repo);
    await useCase.execute({ ownerEmail: 'admin@acme.com' });

    expect(repo.listByOwner).toHaveBeenCalledWith('admin@acme.com', { limit: 20, cursor: undefined });
  });
});
