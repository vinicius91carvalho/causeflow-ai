import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createAnalyticsRoutes, type AnalyticsUseCases } from '../../../../src/modules/ingestion/infra/analytics.routes.js';

const mockUseCases = {
  getIncidentAnalytics: { execute: vi.fn() },
};

const app = createTestApp(createAnalyticsRoutes, mockUseCases as unknown as AnalyticsUseCases);

describe('analytics.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.getIncidentAnalytics.execute.mockResolvedValue({
      total: 10,
      byStatus: { open: 3, resolved: 7 },
      bySeverity: { high: 5, medium: 5 },
      mttrMinutes: 45,
      openCount: 3,
      totalCostUsd: 0,
      avgCostUsd: null,
    });
  });

  it('GET /test/incidents returns incident analytics', async () => {
    const res = await app.request('/test/incidents');

    expect(res.status).toBe(200);
    expect(mockUseCases.getIncidentAnalytics.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('total', 10);
    expect(body).toHaveProperty('mttrMinutes', 45);
    expect(body).toHaveProperty('openCount', 3);
  });
});
