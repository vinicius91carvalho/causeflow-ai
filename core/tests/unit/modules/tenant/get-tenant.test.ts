import { describe, it, expect, vi } from 'vitest';
import { GetTenantUseCase } from '../../../../src/modules/tenant/application/get-tenant.usecase.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';
import { TenantNotFoundError } from '../../../../src/modules/tenant/domain/tenant.errors.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

describe('GetTenantUseCase', () => {
  it('should return tenant when found', async () => {
    const mockTenant = { tenantId: 'tenant-1', name: 'Acme' } as Tenant;
    const repo: ITenantRepository = {
      create: vi.fn(),
      findById: vi.fn(async () => mockTenant),
      findBySlug: vi.fn(),
      findByCustomDomain: vi.fn(),
      update: vi.fn(),
      listByOwner: vi.fn(),
    };

    const useCase = new GetTenantUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result).toBe(mockTenant);
  });

  it('should throw TenantNotFoundError when not found', async () => {
    const repo: ITenantRepository = {
      create: vi.fn(),
      findById: vi.fn(async () => null),
      findBySlug: vi.fn(),
      findByCustomDomain: vi.fn(),
      update: vi.fn(),
      listByOwner: vi.fn(),
    };

    const useCase = new GetTenantUseCase(repo);

    await expect(useCase.execute(tenantId('nonexistent'))).rejects.toThrow(TenantNotFoundError);
  });
});
