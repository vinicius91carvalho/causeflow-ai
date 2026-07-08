import { describe, it, expect, vi } from 'vitest';
import { CreateAuditEntryUseCase } from '../../../../src/modules/audit/application/create-audit-entry.usecase.js';
import { DeleteAuditEntryUseCase } from '../../../../src/modules/audit/application/delete-audit-entry.usecase.js';
import type { IAuditRepository } from '../../../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry } from '../../../../src/modules/audit/domain/audit.entity.js';
import { tenantId, auditEntryId } from '../../../../src/shared/domain/value-objects.js';

const T1 = tenantId('tenant-1');
const GENESIS = '0'.repeat(64);

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    tenantId: T1,
    entryId: auditEntryId('e1'),
    action: 'incident.created',
    actorType: 'user',
    actorEmail: 'user@example.com',
    resourceType: 'incident',
    resourceId: 'i1',
    previousHash: GENESIS,
    entryHash: 'abc',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepo(lastEntry: AuditEntry | null): {
  repo: IAuditRepository;
  deletes: string[][];
  creates: AuditEntry[];
} {
  const creates: AuditEntry[] = [];
  const deletes: string[][] = [];
  const repo: IAuditRepository = {
    create: vi.fn(async (e: AuditEntry) => {
      creates.push(e);
      return e;
    }),
    findByTenant: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
    findByAction: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
    getLastEntry: vi.fn(async () => lastEntry),
    pseudonymizeActor: vi.fn(async () => 0),
    findExpired: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
    deleteBatch: vi.fn(async (_t, ids: string[]) => {
      deletes.push(ids);
      return ids.length;
    }),
  };
  return { repo, deletes, creates };
}

describe('DeleteAuditEntryUseCase — AC-008 chain advance', () => {
  it('appends an audit.entry.deleted entry whose previousHash matches the prior tip', async () => {
    const tip = makeEntry({ entryHash: 'tip-hash-123' });
    const { repo, deletes, creates } = makeRepo(tip);
    const deleteUc = new DeleteAuditEntryUseCase(repo, new CreateAuditEntryUseCase(repo));

    const result = await deleteUc.execute({
      tenantId: T1,
      entryId: 'e1' as never,
      actorEmail: 'admin@causeflow.ai',
    });

    expect(result.deleted).toBe(1);
    expect(creates).toHaveLength(1);
    expect(creates[0]!.action).toBe('audit.entry.deleted');
    expect(creates[0]!.resourceId).toBe('e1');
    expect(creates[0]!.previousHash).toBe('tip-hash-123');
    expect(deletes).toEqual([['e1']]);
    expect(result.newEntry.entryHash).toBe(creates[0]!.entryHash);
  });

  it('uses genesis hash when the chain is empty (no prior tip)', async () => {
    const { repo, deletes, creates } = makeRepo(null);
    const deleteUc = new DeleteAuditEntryUseCase(repo, new CreateAuditEntryUseCase(repo));

    const result = await deleteUc.execute({
      tenantId: T1,
      entryId: 'e1' as never,
      actorEmail: 'admin@causeflow.ai',
    });

    expect(creates[0]!.previousHash).toBe(GENESIS);
    expect(result.deleted).toBe(1);
    expect(deletes).toEqual([['e1']]);
  });

  it('previousHash matches prior tip even when the deleted entry IS the tip', async () => {
    const tip = makeEntry({ entryId: auditEntryId('tip-id'), entryHash: 'tip-hash-xyz' });
    const { repo, deletes, creates } = makeRepo(tip);
    const deleteUc = new DeleteAuditEntryUseCase(repo, new CreateAuditEntryUseCase(repo));

    const result = await deleteUc.execute({
      tenantId: T1,
      entryId: 'tip-id' as never,
      actorEmail: 'admin@causeflow.ai',
    });

    expect(creates[0]!.previousHash).toBe('tip-hash-xyz');
    expect(deletes).toEqual([['tip-id']]);
    expect(result.newEntry.previousHash).toBe('tip-hash-xyz');
  });
});
