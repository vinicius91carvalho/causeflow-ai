import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createTenantRoutes, type TenantUseCases } from '../../../../src/modules/tenant/infra/tenant.routes.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';

const mockUseCases = {
  createTenant: { execute: vi.fn() },
  getTenant: { execute: vi.fn() },
  updateTenant: { execute: vi.fn() },
  listTenants: { execute: vi.fn() },
};

const app = createTestApp(createTenantRoutes, mockUseCases as unknown as TenantUseCases);

describe('tenant.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.createTenant.execute.mockResolvedValue({
      tenantId: 'tenant-1',
      name: 'Acme',
      slug: 'acme',
    });
    mockUseCases.getTenant.execute.mockResolvedValue({
      tenantId: 'tenant-1',
      name: 'Acme',
    });
    mockUseCases.updateTenant.execute.mockResolvedValue({
      tenantId: 'tenant-1',
      name: 'New Name',
    });
    mockUseCases.listTenants.execute.mockResolvedValue({
      items: [],
      cursor: undefined,
    });
  });

  it('POST /test with valid body returns 201', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Acme',
        slug: 'acme',
        ownerEmail: 'admin@acme.com',
      }),
    });

    expect(res.status).toBe(201);
    expect(mockUseCases.createTenant.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('tenantId', 'tenant-1');
  });

  it('GET /test/:tenantId returns 200', async () => {
    const res = await app.request('/test/tenant-1');

    expect(res.status).toBe(200);
    expect(mockUseCases.getTenant.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('name', 'Acme');
  });

  it('GET /test/:tenantId returns 404 when not found', async () => {
    // Use tenant-1 to match the JWT tenantId from test context (avoids 403 mismatch)
    mockUseCases.getTenant.execute.mockRejectedValue(
      new NotFoundError('Tenant', 'tenant-1'),
    );

    const res = await app.request('/test/tenant-1');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'NOT_FOUND');
  });

  it('PATCH /test/:tenantId with body returns 200', async () => {
    const res = await app.request('/test/tenant-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.updateTenant.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('name', 'New Name');
  });

  it('GET /test returns 200 and calls listTenants', async () => {
    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(mockUseCases.listTenants.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('items');
  });
});
