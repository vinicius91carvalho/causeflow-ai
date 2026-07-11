import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STSCredentialVendor } from '../../../../src/shared/infra/credentials/sts-credential-vendor.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import type { Tenant } from '../../../../src/modules/tenant/domain/tenant.entity.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

// Local type stub — no external cloud SDK in unit tests (AC-050)
interface MockSTSClient {
  send: ReturnType<typeof vi.fn>;
}

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    aws: { region: 'us-east-1' },
    sts: { roleArn: 'arn:aws:iam::000000000000:role/GlobalRole', roleSessionPrefix: 'causeflow' },
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TENANT_WITH_AWS: Tenant = {
  tenantId: tenantId('tenant-aws'),
  name: 'AWS Corp',
  slug: 'aws-corp',
  ownerEmail: 'admin@aws-corp.com',
  plan: 'enterprise',
  status: 'active',
  settings: {
    maxIncidentsPerMonth: 100,
    autoRemediation: true,
    notificationChannels: [],
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const TENANT_WITHOUT_AWS: Tenant = {
  tenantId: tenantId('tenant-basic'),
  name: 'Basic Corp',
  slug: 'basic-corp',
  ownerEmail: 'admin@basic.com',
  plan: 'starter',
  status: 'active',
  settings: {
    maxIncidentsPerMonth: 50,
    autoRemediation: false,
    notificationChannels: [],
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const STS_RESPONSE = {
  Credentials: {
    AccessKeyId: 'AKIAEXAMPLE',
    SecretAccessKey: 'SECRET',
    SessionToken: 'TOKEN',
    Expiration: new Date('2026-01-01T01:00:00Z'),
  },
};

describe('STSCredentialVendor (tenant-aware)', () => {
  const mockSend = vi.fn();
  const mockSTSClient: MockSTSClient = { send: mockSend };
  let tenantRepo: ITenantRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(STS_RESPONSE);
    tenantRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByCustomDomain: vi.fn(),
      update: vi.fn(),
      listByOwner: vi.fn(),
    };
  });

  it('should use global role when tenant is found', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(TENANT_WITH_AWS);

    const vendor = new STSCredentialVendor(mockSTSClient, tenantRepo);
    await vendor.vend({
      tenantId: 'tenant-aws',
      incidentId: 'inc-1',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: [],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.RoleArn).toBe('arn:aws:iam::000000000000:role/GlobalRole');
  });

  it('should fallback to global config when tenant has no AWS role', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(TENANT_WITHOUT_AWS);

    const vendor = new STSCredentialVendor(mockSTSClient, tenantRepo);
    await vendor.vend({
      tenantId: 'tenant-basic',
      incidentId: 'inc-2',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: [],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.RoleArn).toBe('arn:aws:iam::000000000000:role/GlobalRole');
  });

  it('should fallback to global config when tenant not found', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(null);

    const vendor = new STSCredentialVendor(mockSTSClient, tenantRepo);
    await vendor.vend({
      tenantId: 'nonexistent',
      incidentId: 'inc-3',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: [],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.RoleArn).toBe('arn:aws:iam::000000000000:role/GlobalRole');
  });

  it('should fallback gracefully when tenant lookup throws', async () => {
    vi.mocked(tenantRepo.findById).mockRejectedValue(new Error('DynamoDB timeout'));

    const vendor = new STSCredentialVendor(mockSTSClient, tenantRepo);
    await vendor.vend({
      tenantId: 'tenant-aws',
      incidentId: 'inc-4',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: [],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.RoleArn).toBe('arn:aws:iam::000000000000:role/GlobalRole');
  });

  it('should work without tenantRepo (backward-compatible)', async () => {
    const vendor = new STSCredentialVendor(mockSTSClient);
    await vendor.vend({
      tenantId: 'tenant-1',
      incidentId: 'inc-5',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: [],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.RoleArn).toBe('arn:aws:iam::000000000000:role/GlobalRole');
  });

  it('should prefer requestedPermissions over tenant role', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(TENANT_WITHOUT_AWS);

    const vendor = new STSCredentialVendor(mockSTSClient, tenantRepo);
    await vendor.vend({
      tenantId: 'tenant-basic',
      incidentId: 'inc-6',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: ['arn:aws:iam::999:role/ExplicitRole'],
    });

    const call = mockSend.mock.calls[0]![0];
    // requestedPermissions is the fallback when no tenant role — it should be used
    expect(call.input.RoleArn).toBe('arn:aws:iam::999:role/ExplicitRole');
  });
});
