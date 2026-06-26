import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationError } from '../../../../src/shared/domain/errors.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

// Mock IntegrationEntity before importing the use case
vi.mock('../../../../src/shared/infra/db/entities/IntegrationEntity.js', () => ({
  IntegrationEntity: {
    upsert: vi.fn(() => ({ go: vi.fn().mockResolvedValue({ data: {} }) })),
  },
}));

import { FinalizeConnectionUseCase } from '../../../../src/modules/integration/application/finalize-connection.usecase.js';
import { IntegrationEntity } from '../../../../src/shared/infra/db/entities/IntegrationEntity.js';

describe('FinalizeConnectionUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to default behavior
    (IntegrationEntity.upsert as ReturnType<typeof vi.fn>).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: {} }),
    });
  });

  it('throws ValidationError when connectedAccountId is missing', async () => {
    const useCase = new FinalizeConnectionUseCase();
    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        provider: 'sentry',
        connectedAccountId: '',
        connectedBy: 'user-1',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when connectedAccountId is not a string', async () => {
    const useCase = new FinalizeConnectionUseCase();
    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        provider: 'sentry',
        connectedAccountId: null as unknown as string,
        connectedBy: 'user-1',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns correct output shape on valid input', async () => {
    const useCase = new FinalizeConnectionUseCase();
    const result = await useCase.execute({
      tenantId: tenantId('tenant-1'),
      provider: 'sentry',
      connectedAccountId: 'ca_abc123',
      connectedBy: 'user-1',
    });

    expect(result.connection.provider).toBe('sentry');
    expect(result.connection.status).toBe('connected');
    expect(result.connection.connectedAccountId).toBe('ca_abc123');
    expect(result.connection.id).toBeTruthy();
    expect(result.connection.connectedAt).toBeTruthy();
    // connectedAt should be a valid ISO date string
    expect(() => new Date(result.connection.connectedAt)).not.toThrow();
  });

  it('calls IntegrationEntity.upsert with correct parameters', async () => {
    const useCase = new FinalizeConnectionUseCase();
    await useCase.execute({
      tenantId: tenantId('tenant-xyz'),
      provider: 'github',
      connectedAccountId: 'ca_github_456',
      connectedBy: 'admin-user',
    });

    expect(IntegrationEntity.upsert).toHaveBeenCalledOnce();
    const upsertArgs = (IntegrationEntity.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(upsertArgs.tenantId).toBe('tenant-xyz');
    expect(upsertArgs.provider).toBe('github');
    expect(upsertArgs.status).toBe('active');
    expect(upsertArgs.config.apiKeyRef).toBe('ca_github_456');
    expect(upsertArgs.connectedBy).toBe('admin-user');
  });

  it('emits integration.connected event when eventBus is provided', async () => {
    const mockPublish = vi.fn().mockResolvedValue(undefined);
    const mockEventBus = { publish: mockPublish, subscribe: vi.fn(), unsubscribe: vi.fn() };

    const useCase = new FinalizeConnectionUseCase(mockEventBus);
    await useCase.execute({
      tenantId: tenantId('tenant-1'),
      provider: 'slack',
      connectedAccountId: 'ca_slack_789',
      connectedBy: 'user-99',
    });

    expect(mockPublish).toHaveBeenCalledOnce();
    const event = mockPublish.mock.calls[0]![0];
    expect(event.eventType).toBe('integration.connected');
    expect(event.tenantId).toBe('tenant-1');
    expect(event.payload.provider).toBe('slack');
    expect(event.payload.connectedBy).toBe('user-99');
  });

  it('does not call eventBus when not provided', async () => {
    const useCase = new FinalizeConnectionUseCase();
    // Should complete without error when no eventBus is provided
    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        provider: 'linear',
        connectedAccountId: 'ca_linear_001',
        connectedBy: 'user-1',
      }),
    ).resolves.toBeDefined();
  });
});
