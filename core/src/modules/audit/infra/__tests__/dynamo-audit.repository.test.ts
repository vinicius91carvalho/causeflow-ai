import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantId } from '../../../../shared/domain/value-objects.js';

// ---------------------------------------------------------------------------
// Mock ElectroDB entity
// ---------------------------------------------------------------------------

const mockGoFn = vi.fn();
const mockWhereFn = vi.fn(() => ({ go: mockGoFn }));
const mockQueryPrimary = vi.fn(() => ({ go: mockGoFn }));
const mockQueryByAction = vi.fn(() => ({ go: mockGoFn }));
const mockQueryByCreatedAt = vi.fn(() => ({ go: mockGoFn, where: mockWhereFn }));
const mockCreate = vi.fn(() => ({ go: vi.fn() }));

vi.mock('../../../../shared/infra/db/entities/AuditEntryEntity.js', () => ({
  AuditEntryEntity: {
    query: {
      primary: mockQueryPrimary,
      byAction: mockQueryByAction,
      byCreatedAt: mockQueryByCreatedAt,
    },
    create: mockCreate,
  },
}));

const T1 = 'tenant-1' as unknown as TenantId;
const T2 = 'tenant-2' as unknown as TenantId;

// Lazy import after mocks are set up
async function getRepo() {
  const { DynamoAuditRepository } = await import('../dynamo-audit.repository.js');
  return new DynamoAuditRepository();
}

// ---------------------------------------------------------------------------
// AC-1: Order DESC tests
// ---------------------------------------------------------------------------

describe('DynamoAuditRepository — findByTenant order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoFn.mockResolvedValue({ data: [], cursor: null });
    mockQueryByCreatedAt.mockReturnValue({ go: mockGoFn, where: mockWhereFn });
  });

  it('calls .go() with order: "desc" by default using byCreatedAt index', async () => {
    const repo = await getRepo();
    await repo.findByTenant(T1);

    expect(mockQueryByCreatedAt).toHaveBeenCalledWith({ tenantId: T1 });
    expect(mockGoFn).toHaveBeenCalledWith(
      expect.objectContaining({ order: 'desc' }),
    );
  });

  it('uses default limit of 20 when none supplied', async () => {
    const repo = await getRepo();
    await repo.findByTenant(T1);

    expect(mockGoFn).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, order: 'desc' }),
    );
  });

  it('forwards supplied limit and cursor', async () => {
    const repo = await getRepo();
    await repo.findByTenant(T1, { limit: 5, cursor: 'abc123' });

    expect(mockGoFn).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, cursor: 'abc123', order: 'desc' }),
    );
  });

  it('applies actorType filter via .where() when actorType option is set', async () => {
    mockWhereFn.mockReturnValue({ go: mockGoFn });
    const repo = await getRepo();
    await repo.findByTenant(T1, { actorType: 'user' });

    expect(mockWhereFn).toHaveBeenCalled();
    expect(mockGoFn).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
  });

  it('returns items and cursor from DynamoDB response', async () => {
    const fakeItem = {
      tenantId: 'tenant-1',
      entryId: 'e1',
      action: 'incident.created',
      actorType: 'user',
      actorEmail: 'a@b.com',
      resourceType: 'incident',
      resourceId: 'i1',
      previousHash: '0'.repeat(64),
      entryHash: 'abc',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockGoFn.mockResolvedValue({ data: [fakeItem], cursor: 'next-cursor' });

    const repo = await getRepo();
    const result = await repo.findByTenant(T1);

    expect(result.items).toHaveLength(1);
    expect(result.cursor).toBe('next-cursor');
  });
});

describe('DynamoAuditRepository — findByAction order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoFn.mockResolvedValue({ data: [], cursor: null });
    mockQueryByAction.mockReturnValue({ go: mockGoFn });
  });

  it('calls .go() with order: "desc"', async () => {
    const repo = await getRepo();
    await repo.findByAction(T1, 'incident.created');

    expect(mockGoFn).toHaveBeenCalledWith(
      expect.objectContaining({ order: 'desc' }),
    );
  });

  it('forwards supplied limit, cursor and order:desc together', async () => {
    const repo = await getRepo();
    await repo.findByAction(T1, 'incident.created', { limit: 10, cursor: 'tok' });

    expect(mockGoFn).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, cursor: 'tok', order: 'desc' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant isolation contract
// ---------------------------------------------------------------------------

describe('DynamoAuditRepository — cross-tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries tenant-1 data exclusively when findByTenant is called for tenant-1', async () => {
    const goFn = vi.fn().mockResolvedValue({ data: [{ tenantId: 'tenant-1', entryId: 'e1', action: 'x', actorType: 'system', actorEmail: 'system@causeflow.ai', resourceType: 'incident', resourceId: 'i1', previousHash: '0'.repeat(64), entryHash: 'abc', createdAt: '2026-01-01T00:00:00.000Z' }], cursor: null });
    mockQueryByCreatedAt.mockReturnValue({ go: goFn, where: mockWhereFn });

    const repo = await getRepo();
    const result = await repo.findByTenant(T1);

    // byCreatedAt index is keyed by tenantId — all returned items must belong to T1
    expect(mockQueryByCreatedAt).toHaveBeenCalledWith({ tenantId: T1 });
    for (const item of result.items) {
      expect(item.tenantId).toBe(T1);
    }
  });

  it('queries with tenant-2 key when findByTenant is called for tenant-2', async () => {
    const goFn = vi.fn().mockResolvedValue({ data: [{ tenantId: 'tenant-2', entryId: 'e2', action: 'x', actorType: 'system', actorEmail: 'system@causeflow.ai', resourceType: 'incident', resourceId: 'i2', previousHash: '0'.repeat(64), entryHash: 'def', createdAt: '2026-01-01T00:00:00.000Z' }], cursor: null });
    mockQueryByCreatedAt.mockReturnValue({ go: goFn, where: mockWhereFn });

    const repo = await getRepo();
    const result = await repo.findByTenant(T2);

    expect(mockQueryByCreatedAt).toHaveBeenCalledWith({ tenantId: T2 });
    for (const item of result.items) {
      expect(item.tenantId).toBe(T2);
    }
  });

  it('does not mix tenant-1 and tenant-2 results', async () => {
    const goT1 = vi.fn().mockResolvedValue({ data: [{ tenantId: 'tenant-1', entryId: 'e1', action: 'x', actorType: 'system', actorEmail: 'system@causeflow.ai', resourceType: 'incident', resourceId: 'i1', previousHash: '0'.repeat(64), entryHash: 'abc', createdAt: '2026-01-01T00:00:00.000Z' }], cursor: null });
    const goT2 = vi.fn().mockResolvedValue({ data: [{ tenantId: 'tenant-2', entryId: 'e2', action: 'x', actorType: 'system', actorEmail: 'system@causeflow.ai', resourceType: 'incident', resourceId: 'i2', previousHash: '0'.repeat(64), entryHash: 'def', createdAt: '2026-01-01T00:00:00.000Z' }], cursor: null });

    mockQueryByCreatedAt
      .mockReturnValueOnce({ go: goT1, where: mockWhereFn })
      .mockReturnValueOnce({ go: goT2, where: mockWhereFn });

    const repo = await getRepo();
    const [r1, r2] = await Promise.all([repo.findByTenant(T1), repo.findByTenant(T2)]);

    const t1Ids = r1.items.map((i) => i.tenantId);
    const t2Ids = r2.items.map((i) => i.tenantId);

    expect(t1Ids).not.toEqual(expect.arrayContaining([T2]));
    expect(t2Ids).not.toEqual(expect.arrayContaining([T1]));
  });
});

