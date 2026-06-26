import { describe, it, expect, vi } from 'vitest';
import { RevokeApiKeyUseCase } from '../../../../src/modules/tenant/application/revoke-api-key.usecase.js';
import type { IApiKeyRepository } from '../../../../src/modules/tenant/domain/api-key.repository.js';
import type { IEventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, apiKeyId } from '../../../../src/shared/domain/value-objects.js';

describe('RevokeApiKeyUseCase', () => {
  it('should revoke api key and publish event', async () => {
    const revokedKey = {
      keyId: apiKeyId('key-1'),
      tenantId: tenantId('tenant-1'),
      name: 'my-key',
      keyHash: 'hash',
      prefix: 'cflo_xxxx',
      status: 'revoked' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      revokedAt: '2024-01-02T00:00:00.000Z',
    };

    const repo: IApiKeyRepository = {
      create: vi.fn(),
      findByHash: vi.fn(),
      findById: vi.fn(),
      listByTenant: vi.fn(),
      revoke: vi.fn(async () => revokedKey),
    };

    const eventBus: IEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    const useCase = new RevokeApiKeyUseCase(repo, eventBus);
    const result = await useCase.execute(tenantId('tenant-1'), apiKeyId('key-1'));

    expect(result.status).toBe('revoked');
    expect(result.revokedAt).toBeDefined();
    expect(repo.revoke).toHaveBeenCalledWith(tenantId('tenant-1'), apiKeyId('key-1'));
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'apikey.revoked',
        tenantId: 'tenant-1',
      }),
    );
  });
});
