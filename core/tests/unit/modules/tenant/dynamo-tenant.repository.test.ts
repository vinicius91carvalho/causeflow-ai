import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

const mockEntity = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  query: {
    primary: vi.fn(),
    bySlug: vi.fn(),
    byOwner: vi.fn(),
  },
  patch: vi.fn(),
}));

vi.mock('../../../../src/shared/infra/db/entities/TenantEntity.js', () => ({
  TenantEntity: mockEntity,
}));

import { DynamoTenantRepository } from '../../../../src/modules/tenant/infra/dynamo-tenant.repository.js';

const sampleTenantData = {
  tenantId: 'tenant-1',
  name: 'Acme Corp',
  slug: 'acme',
  ownerEmail: 'admin@acme.com',
  plan: 'pro',
  status: 'active',
  settings: { maxIncidentsPerMonth: 100, autoRemediation: false, notificationChannels: [] },
  creditsTotal: 100,
  creditsUsed: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('DynamoTenantRepository', () => {
  let repo: DynamoTenantRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoTenantRepository();
  });

  it('create() should call TenantEntity.create and return domain object', async () => {
    mockEntity.create.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleTenantData }),
    });

    const tenant = {
      tenantId: tenantId('tenant-1'),
      name: 'Acme Corp',
      slug: 'acme',
      ownerEmail: 'admin@acme.com',
      plan: 'pro' as const,
      status: 'active' as const,
      settings: { maxIncidentsPerMonth: 100, autoRemediation: false, notificationChannels: [] },
      creditsTotal: 100,
      creditsUsed: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = await repo.create(tenant);

    expect(mockEntity.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      name: 'Acme Corp',
      slug: 'acme',
      ownerEmail: 'admin@acme.com',
      plan: 'pro',
      status: 'active',
      settings: { maxIncidentsPerMonth: 100, autoRemediation: false, notificationChannels: [] },
      renewDate: undefined,
      websiteUrl: undefined,
      teamSize: undefined,
    });
    expect(result.tenantId).toBe('tenant-1');
    expect(result.name).toBe('Acme Corp');
    expect(result.slug).toBe('acme');
  });

  it('findById() should return domain object when found', async () => {
    mockEntity.get.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: sampleTenantData }),
    });

    const result = await repo.findById(tenantId('tenant-1'));

    expect(mockEntity.get).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).not.toBeNull();
    expect(result!.tenantId).toBe('tenant-1');
    expect(result!.plan).toBe('pro');
  });

  it('findById() should return null when not found', async () => {
    mockEntity.get.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: null }),
    });

    const result = await repo.findById(tenantId('nonexistent'));

    expect(mockEntity.get).toHaveBeenCalledWith({ tenantId: 'nonexistent' });
    expect(result).toBeNull();
  });

  it('findBySlug() should return first matching tenant', async () => {
    mockEntity.query.bySlug.mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [sampleTenantData] }),
    });

    const result = await repo.findBySlug('acme');

    expect(mockEntity.query.bySlug).toHaveBeenCalledWith({ slug: 'acme' });
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('acme');
    expect(result!.ownerEmail).toBe('admin@acme.com');
  });

  it('update() should call patch().set().go() and return updated domain object', async () => {
    const updatedData = { ...sampleTenantData, name: 'Acme Corp Updated' };
    const mockSetGo = vi.fn().mockResolvedValue({ data: updatedData });
    const mockSet = vi.fn().mockReturnValue({ go: mockSetGo });
    mockEntity.patch.mockReturnValue({ set: mockSet });

    const result = await repo.update(tenantId('tenant-1'), { name: 'Acme Corp Updated' });

    expect(mockEntity.patch).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(mockSet).toHaveBeenCalledWith({ name: 'Acme Corp Updated' });
    expect(mockSetGo).toHaveBeenCalledWith({ response: 'all_new' });
    expect(result.name).toBe('Acme Corp Updated');
  });

  it('listByOwner() should call query.byOwner with options and return paginated result', async () => {
    mockEntity.query.byOwner.mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [sampleTenantData],
        cursor: 'next-cursor',
      }),
    });

    const result = await repo.listByOwner('admin@acme.com', { limit: 10 });

    expect(mockEntity.query.byOwner).toHaveBeenCalledWith({ ownerEmail: 'admin@acme.com' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.tenantId).toBe('tenant-1');
    expect(result.cursor).toBe('next-cursor');
  });
});
