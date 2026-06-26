import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createAuditRoutes, type AuditUseCases } from '../../../../src/modules/audit/infra/audit.routes.js';

const mockUseCases = {
  listAuditEntries: { execute: vi.fn() },
  verifyHashChain: { execute: vi.fn() },
};

const app = createTestApp(createAuditRoutes, mockUseCases as unknown as AuditUseCases);

describe('audit.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.listAuditEntries.execute.mockResolvedValue({
      items: [],
      cursor: undefined,
    });
    mockUseCases.verifyHashChain.execute.mockResolvedValue({
      valid: true,
      checkedCount: 10,
    });
  });

  it('GET /test returns 200 and calls listAuditEntries', async () => {
    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(mockUseCases.listAuditEntries.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('items');
  });

  it('GET /test?action=tenant.created passes action filter', async () => {
    const res = await app.request('/test?action=tenant.created');

    expect(res.status).toBe(200);
    expect(mockUseCases.listAuditEntries.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant.created' }),
    );
  });

  it('GET /test/verify returns 200 and calls verifyHashChain', async () => {
    const res = await app.request('/test/verify');

    expect(res.status).toBe(200);
    expect(mockUseCases.verifyHashChain.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('valid', true);
  });
});
