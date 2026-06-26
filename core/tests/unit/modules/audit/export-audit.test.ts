import { describe, it, expect, vi } from 'vitest';
import { ExportAuditUseCase } from '../../../../src/modules/audit/application/export-audit.usecase.js';
import type { IAuditRepository } from '../../../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry } from '../../../../src/modules/audit/domain/audit.entity.js';
import { tenantId, auditEntryId } from '../../../../src/shared/domain/value-objects.js';

function makeEntry(id: string): AuditEntry {
  return {
    tenantId: tenantId('tenant-1'),
    entryId: auditEntryId(id),
    action: 'incident.created',
    actorType: 'system',
    actorEmail: 'system@causeflow.ai',
    resourceType: 'incident',
    resourceId: 'inc-1',
    previousHash: 'prev',
    entryHash: 'hash',
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('ExportAuditUseCase', () => {
  it('should yield all entries across pages', async () => {
    const page1 = [makeEntry('e1'), makeEntry('e2')];
    const page2 = [makeEntry('e3')];

    const repo: IAuditRepository = {
      create: vi.fn(),
      findByTenant: vi.fn()
        .mockResolvedValueOnce({ items: page1, cursor: 'cursor-1' })
        .mockResolvedValueOnce({ items: page2, cursor: undefined }),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new ExportAuditUseCase(repo);
    const entries: AuditEntry[] = [];

    for await (const entry of useCase.execute({ tenantId: tenantId('tenant-1') })) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(3);
    expect(entries[0]!.entryId).toBe('e1');
    expect(entries[2]!.entryId).toBe('e3');
    expect(repo.findByTenant).toHaveBeenCalledTimes(2);
  });

  it('should filter by action when provided', async () => {
    const repo: IAuditRepository = {
      create: vi.fn(),
      findByTenant: vi.fn(),
      findByAction: vi.fn().mockResolvedValueOnce({ items: [makeEntry('e1')], cursor: undefined }),
      getLastEntry: vi.fn(),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new ExportAuditUseCase(repo);
    const entries: AuditEntry[] = [];

    for await (const entry of useCase.execute({ tenantId: tenantId('tenant-1'), action: 'incident.created' })) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(repo.findByAction).toHaveBeenCalledOnce();
    expect(repo.findByTenant).not.toHaveBeenCalled();
  });

  it('should handle empty results', async () => {
    const repo: IAuditRepository = {
      create: vi.fn(),
      findByTenant: vi.fn().mockResolvedValueOnce({ items: [], cursor: undefined }),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new ExportAuditUseCase(repo);
    const entries: AuditEntry[] = [];

    for await (const entry of useCase.execute({ tenantId: tenantId('tenant-1') })) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(0);
  });
});
