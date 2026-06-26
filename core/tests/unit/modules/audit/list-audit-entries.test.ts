import { describe, it, expect, vi } from 'vitest';
import { ListAuditEntriesUseCase } from '../../../../src/modules/audit/application/list-audit-entries.usecase.js';
import type { IAuditRepository } from '../../../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry } from '../../../../src/modules/audit/domain/audit.entity.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

describe('ListAuditEntriesUseCase', () => {
  it('should list all entries for a tenant', async () => {
    const entries = [
      { entryId: 'e-1', action: 'tenant.created' },
      { entryId: 'e-2', action: 'tenant.updated' },
    ] as AuditEntry[];

    const repo: IAuditRepository = {
      create: vi.fn(),
      findByTenant: vi.fn(async () => ({ items: entries, cursor: undefined })),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new ListAuditEntriesUseCase(repo);
    const result = await useCase.execute({ tenantId: tenantId('tenant-1') });

    expect(result.items).toHaveLength(2);
    expect(repo.findByTenant).toHaveBeenCalledWith(tenantId('tenant-1'), { limit: 20, cursor: undefined });
  });

  it('should filter entries by action', async () => {
    const entries = [{ entryId: 'e-1', action: 'tenant.created' }] as AuditEntry[];

    const repo: IAuditRepository = {
      create: vi.fn(),
      findByTenant: vi.fn(),
      findByAction: vi.fn(async () => ({ items: entries, cursor: undefined })),
      getLastEntry: vi.fn(),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new ListAuditEntriesUseCase(repo);
    const result = await useCase.execute({ tenantId: tenantId('tenant-1'), action: 'tenant.created' });

    expect(result.items).toHaveLength(1);
    expect(repo.findByAction).toHaveBeenCalledWith(tenantId('tenant-1'), 'tenant.created', { limit: 20, cursor: undefined });
    expect(repo.findByTenant).not.toHaveBeenCalled();
  });
});
