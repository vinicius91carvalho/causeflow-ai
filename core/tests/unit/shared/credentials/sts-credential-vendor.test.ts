import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STSCredentialVendor } from '../../../../src/shared/infra/credentials/sts-credential-vendor.js';

// Local type stub — no external cloud SDK in unit tests (AC-050)
interface MockSTSClient {
  send: ReturnType<typeof vi.fn>;
}

// Mock config before import
vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    aws: { region: 'sa-east-1' },
    sts: {
      roleArn: 'arn:aws:iam::123456789012:role/CauseFlowRole',
      roleSessionPrefix: 'causeflow',
      defaultDuration: 900,
      maxDuration: 3600,
    },
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('STSCredentialVendor', () => {
  const mockSend = vi.fn();
  const mockSTSClient: MockSTSClient = { send: mockSend };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should vend credentials with correct AssumeRole params', async () => {
    mockSend.mockResolvedValue({
      Credentials: {
        AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY',
        SessionToken: 'FwoGZXIvYXdzEJr...',
        Expiration: new Date('2026-01-01T01:00:00Z'),
      },
    });

    const vendor = new STSCredentialVendor(mockSTSClient);
    const creds = await vendor.vend({
      tenantId: 'tenant-123',
      incidentId: 'inc-456',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: ['arn:aws:iam::123456789012:role/CauseFlowRole'],
    });

    expect(creds.provider).toBe('aws');
    expect(creds.credentials['accessKeyId']).toBe('AKIAIOSFODNN7EXAMPLE');
    expect(creds.credentials['secretAccessKey']).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY');
    expect(creds.credentials['sessionToken']).toBe('FwoGZXIvYXdzEJr...');
    expect(creds.region).toBe('sa-east-1');
    expect(creds.expiresAt).toBe('2026-01-01T01:00:00.000Z');

    // Verify AssumeRole call
    const call = mockSend.mock.calls[0]![0];
    expect(call.input.ExternalId).toBe('tenant-123');
    expect(call.input.RoleSessionName).toContain('causeflow-inc-456-log_analyst');
    expect(call.input.DurationSeconds).toBe(900); // agent duration
    // Session policy is NOT sent for investigation agents — only for remediator
    expect(call.input.Policy).toBeUndefined();
  });

  it('should use longer duration for remediator', async () => {
    mockSend.mockResolvedValue({
      Credentials: {
        AccessKeyId: 'AKID',
        SecretAccessKey: 'SECRET',
        SessionToken: 'TOKEN',
        Expiration: new Date(),
      },
    });

    const vendor = new STSCredentialVendor(mockSTSClient);
    await vendor.vend({
      tenantId: 'tenant-123',
      incidentId: 'inc-456',
      agentRole: 'remediator',
      provider: 'aws',
      requestedPermissions: ['arn:aws:iam::123456789012:role/CauseFlowRole'],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.DurationSeconds).toBe(3600); // remediation duration
  });

  it('should use requestedPermissions[0] as roleArn when provided', async () => {
    mockSend.mockResolvedValue({
      Credentials: {
        AccessKeyId: 'AKID',
        SecretAccessKey: 'SECRET',
        SessionToken: 'TOKEN',
        Expiration: new Date(),
      },
    });

    const vendor = new STSCredentialVendor(mockSTSClient);
    await vendor.vend({
      tenantId: 'tenant-123',
      incidentId: 'inc-456',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: ['arn:aws:iam::999:role/CustomRole'],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.RoleArn).toBe('arn:aws:iam::999:role/CustomRole');
  });

  it('should throw if STS returns no credentials', async () => {
    mockSend.mockResolvedValue({ Credentials: undefined });

    const vendor = new STSCredentialVendor(mockSTSClient);
    await expect(
      vendor.vend({
        tenantId: 'tenant-123',
        incidentId: 'inc-456',
        agentRole: 'log_analyst',
        provider: 'aws',
        requestedPermissions: ['arn:aws:iam::123456789012:role/CauseFlowRole'],
      }),
    ).rejects.toThrow('STS AssumeRole returned no credentials');
  });

  it('should include session policy only for remediator', async () => {
    mockSend.mockResolvedValue({
      Credentials: {
        AccessKeyId: 'AKID',
        SecretAccessKey: 'SECRET',
        SessionToken: 'TOKEN',
        Expiration: new Date(),
      },
    });

    const vendor = new STSCredentialVendor(mockSTSClient);
    await vendor.vend({
      tenantId: 'tenant-123',
      incidentId: 'inc-456',
      agentRole: 'remediator',
      provider: 'aws',
      requestedPermissions: ['arn:aws:iam::123456789012:role/CauseFlowRole'],
    });

    const call = mockSend.mock.calls[0]![0];
    const policy = JSON.parse(call.input.Policy as string);
    expect(policy.Statement[0].Action).toContain('ecs:UpdateService');
    expect(policy.Statement[0].Action).toContain('ssm:SendCommand');
  });

  it('should truncate session name to 64 chars', async () => {
    mockSend.mockResolvedValue({
      Credentials: {
        AccessKeyId: 'AKID',
        SecretAccessKey: 'SECRET',
        SessionToken: 'TOKEN',
        Expiration: new Date(),
      },
    });

    const vendor = new STSCredentialVendor(mockSTSClient);
    await vendor.vend({
      tenantId: 'tenant-123',
      incidentId: 'very-long-incident-id-that-exceeds-the-limit-of-64-characters',
      agentRole: 'log_analyst',
      provider: 'aws',
      requestedPermissions: ['arn:aws:iam::123456789012:role/CauseFlowRole'],
    });

    const call = mockSend.mock.calls[0]![0];
    expect(call.input.RoleSessionName.length).toBeLessThanOrEqual(64);
  });

  it('revoke should resolve without error', async () => {
    const vendor = new STSCredentialVendor(mockSTSClient);
    await expect(vendor.revoke('tenant-123', 'inc-456')).resolves.toBeUndefined();
  });
});
