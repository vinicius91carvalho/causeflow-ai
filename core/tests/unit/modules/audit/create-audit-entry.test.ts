import { describe, it, expect, vi } from 'vitest';
import { CreateAuditEntryUseCase } from '../../../../src/modules/audit/application/create-audit-entry.usecase.js';
import type { IAuditRepository } from '../../../../src/modules/audit/domain/audit.repository.js';
import type { AuditEntry, AuditEvidence } from '../../../../src/modules/audit/domain/audit.entity.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

describe('CreateAuditEntryUseCase', () => {
  it('should create audit entry with genesis hash when no prior entries', async () => {
    const repo: IAuditRepository = {
      create: vi.fn(async (e: AuditEntry) => e),
      findByTenant: vi.fn(),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(async () => null),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new CreateAuditEntryUseCase(repo);
    const entry = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      action: 'tenant.created',
      actorType: 'user',
      actorEmail: 'admin@test.com',
      resourceType: 'tenant',
      resourceId: 'tenant-1',
    });

    expect(entry.previousHash).toBe('0'.repeat(64));
    expect(entry.entryHash).toBeTruthy();
    expect(entry.entryHash).toHaveLength(64);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('should chain hash from previous entry', async () => {
    const lastEntry = {
      entryHash: 'abc123'.padEnd(64, '0'),
    } as AuditEntry;

    const repo: IAuditRepository = {
      create: vi.fn(async (e: AuditEntry) => e),
      findByTenant: vi.fn(),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(async () => lastEntry),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new CreateAuditEntryUseCase(repo);
    const entry = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      action: 'tenant.updated',
      actorType: 'user',
      actorEmail: 'admin@test.com',
      resourceType: 'tenant',
      resourceId: 'tenant-1',
      changes: { name: 'new name' },
    });

    expect(entry.previousHash).toBe(lastEntry.entryHash);
    expect(entry.entryHash).not.toBe(lastEntry.entryHash);
  });

  it('should store actorType and actorEmail from input (AC-2: user actor)', async () => {
    const createSpy = vi.fn(async (e: AuditEntry) => e);
    const repo: IAuditRepository = {
      create: createSpy,
      findByTenant: vi.fn(),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(async () => null),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new CreateAuditEntryUseCase(repo);
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
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

  // AC-3: evidences round-trip through use case
  it('should pass evidences through to repo.create when provided', async () => {
    const createSpy = vi.fn(async (e: AuditEntry) => e);
    const repo: IAuditRepository = {
      create: createSpy,
      findByTenant: vi.fn(),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(async () => null),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const evidences: AuditEvidence[] = [
      { type: 'log', content: 'CPU spike detected at 99%', source: 'cloudwatch' },
      { type: 'metric', content: 'p99 latency 3200ms' },
    ];

    const useCase = new CreateAuditEntryUseCase(repo);
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      action: 'investigation.completed',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'incident',
      resourceId: 'inc-1',
      evidences,
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ evidences }),
    );
  });

  it('should omit evidences field when not provided (backward compat)', async () => {
    const createSpy = vi.fn(async (e: AuditEntry) => e);
    const repo: IAuditRepository = {
      create: createSpy,
      findByTenant: vi.fn(),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(async () => null),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new CreateAuditEntryUseCase(repo);
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      action: 'tenant.created',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'tenant',
      resourceId: 'tenant-1',
    });

    const calledWith = createSpy.mock.calls[0]![0];
    expect(calledWith.evidences).toBeUndefined();
  });

  // AC-2: system fallback when no actor present
  it('should accept system actor type for background events', async () => {
    const createSpy = vi.fn(async (e: AuditEntry) => e);
    const repo: IAuditRepository = {
      create: createSpy,
      findByTenant: vi.fn(),
      findByAction: vi.fn(),
      getLastEntry: vi.fn(async () => null),
      pseudonymizeActor: vi.fn(async () => 0),
      findExpired: vi.fn(async () => ({ items: [], cursor: undefined })),
      deleteBatch: vi.fn(async () => 0),
    };

    const useCase = new CreateAuditEntryUseCase(repo);
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      action: 'credential.vended',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'credential',
      resourceId: 'cred-1',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'system', actorEmail: 'system@causeflow.ai' }),
    );
  });

});
