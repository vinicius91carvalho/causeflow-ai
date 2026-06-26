import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { VerifyHashChainUseCase } from '../../../../src/modules/audit/application/verify-hash-chain.usecase.js';
import type { IAuditRepository } from '../../../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry } from '../../../../src/modules/audit/domain/audit.entity.js';
import { AuditHashChainBrokenError } from '../../../../src/modules/audit/domain/audit.errors.js';
import { tenantId, auditEntryId } from '../../../../src/shared/domain/value-objects.js';

function computeHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function createEntry(index: number, previousHash: string): AuditEntry {
  const tid = tenantId('tenant-1');
  const eid = auditEntryId(`entry-${index}`);
  const now = `2024-01-0${index}T00:00:00.000Z`;

  const hashPayload = [previousHash, tid, eid, 'tenant.created', 'admin@test.com', 'tenant', 'tenant-1', '', now].join('|');
  const entryHash = computeHash(hashPayload);

  return {
    tenantId: tid,
    entryId: eid,
    action: 'tenant.created',
    actorType: 'user',
    actorEmail: 'admin@test.com',
    resourceType: 'tenant',
    resourceId: 'tenant-1',
    previousHash,
    entryHash,
    createdAt: now,
  };
}

describe('VerifyHashChainUseCase', () => {
  it('should verify a valid hash chain', async () => {
    const genesis = '0'.repeat(64);
    const entry1 = createEntry(1, genesis);
    const entry2 = createEntry(2, entry1.entryHash);

    const repo: IAuditRepository = {
      create: vi.fn(),
      findByTenant: vi.fn(async () => ({ items: [entry1, entry2], cursor: undefined })),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new VerifyHashChainUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(2);
  });

  it('should throw AuditHashChainBrokenError for broken chain', async () => {
    const entry1 = createEntry(1, '0'.repeat(64));
    const brokenEntry: AuditEntry = {
      ...createEntry(2, entry1.entryHash),
      previousHash: 'wrong-hash'.padEnd(64, '0'),
    };

    const repo: IAuditRepository = {
      create: vi.fn(),
      findByTenant: vi.fn(async () => ({ items: [entry1, brokenEntry], cursor: undefined })),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new VerifyHashChainUseCase(repo);

    await expect(useCase.execute(tenantId('tenant-1'))).rejects.toThrow(AuditHashChainBrokenError);
  });
});
