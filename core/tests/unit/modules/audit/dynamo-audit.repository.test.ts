import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

const mockEntity = vi.hoisted(() => ({
  create: vi.fn(),
  query: {
    primary: vi.fn(),
    byAction: vi.fn(),
    byCreatedAt: vi.fn(),
  },
}));

vi.mock('../../../../src/shared/infra/db/entities/AuditEntryEntity.js', () => ({
  AuditEntryEntity: mockEntity,
}));

import { DynamoAuditRepository } from '../../../../src/modules/audit/infra/dynamo-audit.repository.js';

const sampleAuditData = {
  tenantId: 'tenant-1',
  entryId: 'audit-1',
  action: 'tenant.created',
  actorType: 'system',
  actorEmail: 'system@causeflow.ai',
  resourceType: 'tenant',
  resourceId: 'tenant-1',
  changes: undefined,
  previousHash: 'hash-0',
  entryHash: 'hash-1',
  createdAt: '2024-01-01T00:00:00Z',
};

describe('DynamoAuditRepository', () => {
  let repo: DynamoAuditRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoAuditRepository();
  });

  it('create() should call AuditEntryEntity.create and return domain object', async () => {
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleAuditData }),
    });

    const entry = {
      tenantId: tenantId('tenant-1'),
      entryId: 'audit-1' as any,
      action: 'tenant.created' as const,
      actorType: 'system' as const,
      actorEmail: 'system@causeflow.ai',
      resourceType: 'tenant',
      resourceId: 'tenant-1',
      changes: undefined,
      previousHash: 'hash-0',
      entryHash: 'hash-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const result = await repo.create(entry);

    expect(mockEntity.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      entryId: 'audit-1',
      action: 'tenant.created',
      actorType: 'system',
      actorEmail: 'system@causeflow.ai',
      resourceType: 'tenant',
      resourceId: 'tenant-1',
      changes: undefined,
      previousHash: 'hash-0',
      entryHash: 'hash-1',
    });
    expect(result.tenantId).toBe('tenant-1');
    expect(result.entryId).toBe('audit-1');
    expect(result.action).toBe('tenant.created');
  });

  it('findByTenant() should call query.byCreatedAt (gsi3) with options and return paginated result', async () => {
    const mockGo = vi.fn().mockResolvedValue({
      data: [sampleAuditData],
      cursor: 'next-cursor',
    });
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: mockGo,
      where: vi.fn(() => ({ go: mockGo })),
    });

    const result = await repo.findByTenant(tenantId('tenant-1'), { limit: 10 });

    expect(mockEntity.query.byCreatedAt).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.action).toBe('tenant.created');
    expect(result.cursor).toBe('next-cursor');
  });

  it('findByTenant() should call .go() with order: "desc"', async () => {
    const mockGo = vi.fn().mockResolvedValue({ data: [], cursor: null });
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: mockGo,
      where: vi.fn(() => ({ go: mockGo })),
    });

    await repo.findByTenant(tenantId('tenant-1'));

    expect(mockGo).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
  });

  it('findByAction() should call query.byAction with tenantId and action', async () => {
    const mockGo = vi.fn().mockResolvedValue({
      data: [sampleAuditData],
      cursor: null,
    });
    mockEntity.query.byAction.mockReturnValue({ go: mockGo });

    const result = await repo.findByAction(tenantId('tenant-1'), 'tenant.created', { limit: 5 });

    expect(mockEntity.query.byAction).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'tenant.created',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.entryHash).toBe('hash-1');
    expect(result.cursor).toBeUndefined();
  });

  it('findByAction() should call .go() with order: "desc"', async () => {
    const mockGo = vi.fn().mockResolvedValue({ data: [], cursor: null });
    mockEntity.query.byAction.mockReturnValue({ go: mockGo });

    await repo.findByAction(tenantId('tenant-1'), 'tenant.created');

    expect(mockGo).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
  });

  it('getLastEntry() should return domain object when entries exist', async () => {
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [sampleAuditData],
      }),
    });

    const result = await repo.getLastEntry(tenantId('tenant-1'));

    // Must query the byCreatedAt GSI (chronological tip), not the primary
    // index (which is sorted by entryId UUID and would return the wrong tip).
    expect(mockEntity.query.byCreatedAt).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).not.toBeNull();
    expect(result!.entryId).toBe('audit-1');
    expect(result!.previousHash).toBe('hash-0');
  });

  it('getLastEntry() should return null when no entries exist', async () => {
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [],
      }),
    });

    const result = await repo.getLastEntry(tenantId('tenant-1'));

    expect(mockEntity.query.byCreatedAt).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).toBeNull();
  });

  it('getLastEntry() should query byCreatedAt with order: "desc" (chronological tip)', async () => {
    const mockGo = vi.fn().mockResolvedValue({ data: [sampleAuditData] });
    mockEntity.query.byCreatedAt.mockReturnValue({ go: mockGo });

    await repo.getLastEntry(tenantId('tenant-1'));

    expect(mockGo).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc', limit: 1 }));
  });

  // AC-3: evidences round-trip in repository
  it('create() should serialize evidences to JSON string when present', async () => {
    const evidences = [{ type: 'log', content: 'Error spike', source: 'cloudwatch' }];
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: { ...sampleAuditData, evidences: JSON.stringify(evidences) },
      }),
    });

    const entry = {
      ...sampleAuditData,
      tenantId: tenantId('tenant-1') as any,
      entryId: 'audit-1' as any,
      action: 'investigation.completed' as const,
      actorType: 'system' as const,
      evidences,
    };

    await repo.create(entry);

    expect(mockEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ evidences: JSON.stringify(evidences) }),
    );
  });

  it('create() should omit evidences key when not provided', async () => {
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleAuditData }),
    });

    const entry = {
      tenantId: tenantId('tenant-1') as any,
      entryId: 'audit-1' as any,
      action: 'tenant.created' as const,
      actorType: 'system' as const,
      actorEmail: 'system@causeflow.ai',
      resourceType: 'tenant',
      resourceId: 'tenant-1',
      changes: undefined,
      previousHash: 'hash-0',
      entryHash: 'hash-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    await repo.create(entry);

    const callArg = mockEntity.create.mock.calls[0]![0] as Record<string, unknown>;
    expect('evidences' in callArg).toBe(false);
  });

  it('toDomain() should deserialize evidences JSON string to array', async () => {
    const evidences = [{ type: 'metric', content: 'p99=3200ms' }];
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: { ...sampleAuditData, evidences: JSON.stringify(evidences) },
      }),
    });

    const entry = {
      ...sampleAuditData,
      tenantId: tenantId('tenant-1') as any,
      entryId: 'audit-1' as any,
      action: 'investigation.completed' as const,
      actorType: 'system' as const,
      evidences,
    };

    const result = await repo.create(entry);
    expect(result.evidences).toEqual(evidences);
  });

  it('toDomain() should leave evidences undefined when field is absent', async () => {
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleAuditData }),
    });

    const entry = {
      tenantId: tenantId('tenant-1') as any,
      entryId: 'audit-1' as any,
      action: 'tenant.created' as const,
      actorType: 'system' as const,
      actorEmail: 'system@causeflow.ai',
      resourceType: 'tenant',
      resourceId: 'tenant-1',
      changes: undefined,
      previousHash: 'hash-0',
      entryHash: 'hash-1',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const result = await repo.create(entry);
    expect(result.evidences).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Cross-tenant isolation contract
  //
  // NOTE: A full LocalStack-DynamoDB integration test is the proper home for
  // end-to-end isolation verification (real partition-key enforcement).  Those
  // are out of scope here because the proot environment cannot run
  // docker-compose reliably.  The assertions below validate the partition key
  // argument at the call boundary — if the repository stops scoping queries by
  // tenantId, these assertions fail immediately.
  // ---------------------------------------------------------------------------

  it('findByTenant() should only query with the provided tenantId (no cross-tenant leak)', async () => {
    const mockGoTenantA = vi
      .fn()
      .mockResolvedValue({ data: [{ ...sampleAuditData, tenantId: 'tenant-A' }], cursor: null });
    const mockGoTenantB = vi.fn().mockResolvedValue({
      data: [{ ...sampleAuditData, tenantId: 'tenant-B', entryId: 'audit-B' }],
      cursor: null,
    });

    mockEntity.query.byCreatedAt
      .mockReturnValueOnce({ go: mockGoTenantA, where: vi.fn(() => ({ go: mockGoTenantA })) })
      .mockReturnValueOnce({ go: mockGoTenantB, where: vi.fn(() => ({ go: mockGoTenantB })) });

    const resultA = await repo.findByTenant(tenantId('tenant-A'));
    const resultB = await repo.findByTenant(tenantId('tenant-B'));

    // Each call queries its own partition key
    expect(mockEntity.query.byCreatedAt).toHaveBeenNthCalledWith(1, { tenantId: 'tenant-A' });
    expect(mockEntity.query.byCreatedAt).toHaveBeenNthCalledWith(2, { tenantId: 'tenant-B' });

    // Results are isolated: tenant-A items not in tenant-B results
    const tenantAIds = resultA.items.map((i) => i.tenantId);
    const tenantBIds = resultB.items.map((i) => i.tenantId);
    expect(tenantAIds.every((id) => id === 'tenant-A')).toBe(true);
    expect(tenantBIds.every((id) => id === 'tenant-B')).toBe(true);

    // No overlap
    const allIds = [...resultA.items.map((i) => i.entryId), ...resultB.items.map((i) => i.entryId)];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('findByTenant() for tenant-A should never return rows seeded for tenant-B', async () => {
    const tenantAData = { ...sampleAuditData, tenantId: 'tenant-A', entryId: 'entry-A1' };
    const mockGo = vi.fn().mockResolvedValue({ data: [tenantAData], cursor: null });
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: mockGo,
      where: vi.fn(() => ({ go: mockGo })),
    });

    const result = await repo.findByTenant(tenantId('tenant-A'));

    // Repository MUST pass tenantId to the ElectroDB index — DynamoDB partition key enforces isolation
    expect(mockEntity.query.byCreatedAt).toHaveBeenCalledWith({ tenantId: 'tenant-A' });
    // All returned items belong to tenant-A
    expect(result.items.every((item) => item.tenantId === 'tenant-A')).toBe(true);
  });

  it('getLastEntry() for tenant-A must scope query.byCreatedAt to tenant-A partition key', async () => {
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [{ ...sampleAuditData, tenantId: 'tenant-A' }] }),
    });

    await repo.getLastEntry(tenantId('tenant-A'));

    // Asserts the partition key argument — proves DynamoDB isolation at the call boundary
    expect(mockEntity.query.byCreatedAt).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-A' }),
    );
  });

  it('getLastEntry() for tenant-B must scope query.byCreatedAt to tenant-B partition key', async () => {
    mockEntity.query.byCreatedAt.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [{ ...sampleAuditData, tenantId: 'tenant-B' }] }),
    });

    await repo.getLastEntry(tenantId('tenant-B'));

    // Asserts the partition key argument — proves DynamoDB isolation at the call boundary
    expect(mockEntity.query.byCreatedAt).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-B' }),
    );
  });

  it('getLastEntry() queries are not cross-contaminated between tenants', async () => {
    mockEntity.query.byCreatedAt
      .mockReturnValueOnce({
        go: vi.fn().mockResolvedValue({
          data: [{ ...sampleAuditData, tenantId: 'tenant-A', entryId: 'last-A' }],
        }),
      })
      .mockReturnValueOnce({
        go: vi.fn().mockResolvedValue({
          data: [{ ...sampleAuditData, tenantId: 'tenant-B', entryId: 'last-B' }],
        }),
      });

    const lastA = await repo.getLastEntry(tenantId('tenant-A'));
    const lastB = await repo.getLastEntry(tenantId('tenant-B'));

    // Each call must use its own partition key — no shared query arg
    expect(mockEntity.query.byCreatedAt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tenantId: 'tenant-A' }),
    );
    expect(mockEntity.query.byCreatedAt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tenantId: 'tenant-B' }),
    );
    // Results must not bleed across tenants
    expect(lastA!.entryId).toBe('last-A');
    expect(lastB!.entryId).toBe('last-B');
  });

  it('findByAction() must scope query.byAction to the provided tenantId partition key', async () => {
    const mockGo = vi.fn().mockResolvedValue({ data: [sampleAuditData], cursor: null });
    mockEntity.query.byAction.mockReturnValue({ go: mockGo });

    await repo.findByAction(tenantId('tenant-A'), 'tenant.created');

    // Asserts the partition key argument — proves DynamoDB isolation at the call boundary
    expect(mockEntity.query.byAction).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-A' }),
    );
  });

  it('findByAction() for tenant-B must scope query to tenant-B partition key', async () => {
    const mockGo = vi.fn().mockResolvedValue({ data: [], cursor: null });
    mockEntity.query.byAction.mockReturnValue({ go: mockGo });

    await repo.findByAction(tenantId('tenant-B'), 'incident.created');

    // Asserts the partition key argument — proves DynamoDB isolation at the call boundary
    expect(mockEntity.query.byAction).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-B' }),
    );
  });
});
