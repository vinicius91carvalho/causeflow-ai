import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createTriageRoutes, type TriageUseCases } from '../../../../src/modules/triage/infra/triage.routes.js';

const mockUseCases = {
  triageIncident: { execute: vi.fn() },
  evidenceRepo: { findByIncident: vi.fn() },
};

const app = createTestApp(createTriageRoutes, mockUseCases as unknown as TriageUseCases);

describe('triage.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.triageIncident.execute.mockResolvedValue({
      incidentId: 'inc-1',
      severity: 'high',
      status: 'triaging',
    });
    mockUseCases.evidenceRepo.findByIncident.mockResolvedValue([]);
  });

  it('POST /test/:incidentId returns 200 and calls triageIncident', async () => {
    const res = await app.request('/test/inc-1', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.triageIncident.execute).toHaveBeenCalledOnce();
  });

  it('GET /test/:incidentId/evidence returns 200 and calls evidenceRepo', async () => {
    const res = await app.request('/test/inc-1/evidence');

    expect(res.status).toBe(200);
    expect(mockUseCases.evidenceRepo.findByIncident).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('items');
  });

  it('POST /test/:incidentId with mock result returns 200 with data', async () => {
    mockUseCases.triageIncident.execute.mockResolvedValue({
      incidentId: 'inc-1',
      severity: 'critical',
      category: 'infrastructure',
      status: 'triaging',
    });

    const res = await app.request('/test/inc-1', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('severity', 'critical');
    expect(body).toHaveProperty('category', 'infrastructure');
  });
});
