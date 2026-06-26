import { describe, it, expect, vi } from 'vitest';
import { CreateApiKeyUseCase } from '../../../../src/modules/tenant/application/create-api-key.usecase.js';
import type { IApiKeyRepository } from '../../../../src/modules/tenant/domain/api-key.repository.js';
import type { ApiKey } from '../../../../src/modules/tenant/domain/api-key.entity.js';
import type { IEventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, apiKeyId } from '../../../../src/shared/domain/value-objects.js';

describe('CreateApiKeyUseCase', () => {
  it('should create an api key with cflo_ prefix and publish event', async () => {
    const createdKey = {
      keyId: apiKeyId('key-1'),
      tenantId: tenantId('tenant-1'),
      name: 'my-key',
      keyHash: 'hash',
      prefix: 'cflo_xxxx',
      status: 'active' as const,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const repo: IApiKeyRepository = {
      create: vi.fn(async (input: ApiKey) => ({ ...input, ...createdKey })),
      findByHash: vi.fn(),
      findById: vi.fn(),
      listByTenant: vi.fn(),
      revoke: vi.fn(),
    };

    const eventBus: IEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    const useCase = new CreateApiKeyUseCase(repo, eventBus);
    const result = await useCase.execute({ tenantId: tenantId('tenant-1'), name: 'my-key' });

    expect(result.plaintext).toMatch(/^cflo_/);
    expect(result.plaintext).toHaveLength(69); // 'cflo_' (5) + 64 hex chars
    expect(repo.create).toHaveBeenCalledOnce();

    const createArg = vi.mocked(repo.create).mock.calls[0]![0];
    expect(createArg.name).toBe('my-key');
    expect(createArg.prefix).toMatch(/^cflo_/);
    expect(createArg.status).toBe('active');
    expect(createArg.keyHash).toHaveLength(64); // SHA-256 hex

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'apikey.created',
        tenantId: 'tenant-1',
      }),
    );
  });
});
