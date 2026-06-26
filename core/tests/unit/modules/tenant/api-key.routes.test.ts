import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createApiKeyRoutes, type ApiKeyUseCases } from '../../../../src/modules/tenant/infra/api-key.routes.js';

const mockUseCases = {
  createApiKey: { execute: vi.fn() },
  listApiKeys: { execute: vi.fn() },
  revokeApiKey: { execute: vi.fn() },
};

const app = createTestApp(createApiKeyRoutes, mockUseCases as unknown as ApiKeyUseCases);

describe('api-key.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.createApiKey.execute.mockResolvedValue({
      apiKey: {
        keyId: 'key-1',
        name: 'my-key',
        prefix: 'cflo_abcd',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      plaintext: 'cflo_abcdef1234567890',
    });
    mockUseCases.listApiKeys.execute.mockResolvedValue([
      {
        keyId: 'key-1',
        tenantId: 'tenant-1',
        name: 'my-key',
        keyHash: 'should-be-hidden',
        prefix: 'cflo_abcd',
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    mockUseCases.revokeApiKey.execute.mockResolvedValue({
      keyId: 'key-1',
      status: 'revoked',
      revokedAt: '2024-01-02T00:00:00.000Z',
    });
  });

  it('POST /test creates api key and returns 201', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'my-key' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('keyId', 'key-1');
    expect(body).toHaveProperty('plaintext');
    expect(body).toHaveProperty('prefix', 'cflo_abcd');
    expect(mockUseCases.createApiKey.execute).toHaveBeenCalledOnce();
  });

  it('POST /test validates name is required', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
  });

  it('GET /test lists api keys without keyHash', async () => {
    const res = await app.request('/test');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body).toHaveProperty('items');
    expect(body.items).toHaveLength(1);
    // keyHash should not be in response
    expect(body.items[0]).not.toHaveProperty('keyHash');
    expect(body.items[0]).toHaveProperty('prefix', 'cflo_abcd');
  });

  it('DELETE /test/:keyId revokes api key', async () => {
    const res = await app.request('/test/key-1', { method: 'DELETE' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'revoked');
    expect(mockUseCases.revokeApiKey.execute).toHaveBeenCalledOnce();
  });
});
