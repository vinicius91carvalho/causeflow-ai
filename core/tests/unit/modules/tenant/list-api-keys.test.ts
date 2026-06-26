import { describe, it, expect, vi } from 'vitest';
import { ListApiKeysUseCase } from '../../../../src/modules/tenant/application/list-api-keys.usecase.js';
import type { IApiKeyRepository } from '../../../../src/modules/tenant/domain/api-key.repository.js';
import { tenantId, apiKeyId } from '../../../../src/shared/domain/value-objects.js';

describe('ListApiKeysUseCase', () => {
  it('should return all api keys for a tenant', async () => {
    const mockKeys = [
      {
        keyId: apiKeyId('key-1'),
        tenantId: tenantId('tenant-1'),
        name: 'key-1',
        keyHash: 'hash-1',
        prefix: 'cflo_xxxx',
        status: 'active' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        keyId: apiKeyId('key-2'),
        tenantId: tenantId('tenant-1'),
        name: 'key-2',
        keyHash: 'hash-2',
        prefix: 'cflo_yyyy',
        status: 'revoked' as const,
        createdAt: '2024-01-02T00:00:00.000Z',
        revokedAt: '2024-01-03T00:00:00.000Z',
      },
    ];

    const repo: IApiKeyRepository = {
      create: vi.fn(),
      findByHash: vi.fn(),
      findById: vi.fn(),
      listByTenant: vi.fn(async () => mockKeys),
      revoke: vi.fn(),
    };

    const useCase = new ListApiKeysUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result).toHaveLength(2);
    expect(repo.listByTenant).toHaveBeenCalledWith(tenantId('tenant-1'));
  });

  it('should return empty array when no keys', async () => {
    const repo: IApiKeyRepository = {
      create: vi.fn(),
      findByHash: vi.fn(),
      findById: vi.fn(),
      listByTenant: vi.fn(async () => []),
      revoke: vi.fn(),
    };

    const useCase = new ListApiKeysUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result).toHaveLength(0);
  });
});
