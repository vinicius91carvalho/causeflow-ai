import { describe, expect, it, vi } from 'vitest';
import type { TenantId, AuditEntryId } from '../../../../shared/domain/value-objects.js';
import type { IAuditRepository } from '../../domain/audit.repository.js';
import type { AuditEntry } from '../../domain/audit.entity.js';
import { CreateAuditEntryUseCase } from '../create-audit-entry.usecase.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const T1 = 'tenant-1' as unknown as TenantId;

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    tenantId: T1,
    entryId: 'e1' as unknown as AuditEntryId,
    action: 'incident.created',
    actorType: 'user',
    actorEmail: 'user@example.com',
    resourceType: 'incident',
    resourceId: 'i1',
    previousHash: '0'.repeat(64),
    entryHash: 'abc',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-2: Actor resolution
// ---------------------------------------------------------------------------

describe('CreateAuditEntryUseCase — actor resolution', () => {
  it('stores actorType: "user" and actorEmail from input when provided', async () => {
    const createSpy = vi.fn().mockResolvedValue(makeEntry());
    const repo: IAuditRepository = {
      create: createSpy,
      findByTenant: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
      findByAction: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
      getLastEntry: vi.fn().mockResolvedValue(null),
      pseudonymizeActor: vi.fn(() => Promise.resolve(0)),
      findExpired: vi.fn(() => Promise.resolve({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(() => Promise.resolve(0)),
    };
    const useCase = new CreateAuditEntryUseCase(repo);

    await useCase.execute({
      tenantId: T1,
      action: 'incident.created',
      actorType: 'user',
      actorEmail: 'alice@example.com',
      resourceType: 'incident',
      resourceId: 'i1',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'user', actorEmail: 'alice@example.com' }),
    );
  });

  it('stores actorType: "system" and system email when actorType is "system"', async () => {
    const createSpy = vi.fn().mockResolvedValue(makeEntry({ actorType: 'system', actorEmail: 'system@causeflow.ai' }));
    const repo: IAuditRepository = {
      create: createSpy,
      findByTenant: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
      findByAction: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
      getLastEntry: vi.fn().mockResolvedValue(null),
      pseudonymizeActor: vi.fn(() => Promise.resolve(0)),
      findExpired: vi.fn(() => Promise.resolve({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(() => Promise.resolve(0)),
    };
    const useCase = new CreateAuditEntryUseCase(repo);

    await useCase.execute({
      tenantId: T1,
      action: 'remediation.executed',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'remediation',
      resourceId: 'r1',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'system', actorEmail: 'system@causeflow.ai' }),
    );
  });
});

