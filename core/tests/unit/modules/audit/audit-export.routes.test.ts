import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createAuditRoutes, type AuditUseCases } from '../../../../src/modules/audit/infra/audit.routes.js';

const mockEntries = [
  { entryId: 'e1', action: 'incident.created', createdAt: '2024-01-01' },
  { entryId: 'e2', action: 'tenant.created', createdAt: '2024-01-02' },
];

async function* mockGenerator() {
  for (const entry of mockEntries) {
    yield entry;
  }
}

const mockUseCases = {
  listAuditEntries: { execute: vi.fn() },
  verifyHashChain: { execute: vi.fn() },
  exportAudit: { execute: vi.fn() },
};

const app = createTestApp(createAuditRoutes, mockUseCases as unknown as AuditUseCases);

describe('audit.routes - export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.listAuditEntries.execute.mockResolvedValue({ items: [], cursor: undefined });
    mockUseCases.verifyHashChain.execute.mockResolvedValue({ valid: true, checkedCount: 10 });
    mockUseCases.exportAudit.execute.mockReturnValue(mockGenerator());
  });

  it('GET /test/export returns NDJSON stream', async () => {
    const res = await app.request('/test/export');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/x-ndjson');
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="audit-/);

    const text = await res.text();
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toHaveProperty('entryId', 'e1');
    expect(JSON.parse(lines[1]!)).toHaveProperty('entryId', 'e2');
  });

  it('GET /test still works for list', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(mockUseCases.listAuditEntries.execute).toHaveBeenCalledOnce();
  });
});
