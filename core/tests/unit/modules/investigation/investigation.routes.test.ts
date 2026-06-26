import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createInvestigationRoutes, type InvestigationUseCases } from '../../../../src/modules/investigation/infra/investigation.routes.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';

const mockUseCases = {
  investigateIncident: { execute: vi.fn() },
  getInvestigation: { execute: vi.fn() },
  addInvestigationContext: { execute: vi.fn() },
  evidenceRepo: { findByIncident: vi.fn() },
};

const app = createTestApp(createInvestigationRoutes, mockUseCases as unknown as InvestigationUseCases);

describe('investigation.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.investigateIncident.execute.mockResolvedValue({
      incidentId: 'inc-1',
      status: 'investigating',
      rootCause: 'Memory leak detected',
    });
    mockUseCases.getInvestigation.execute.mockResolvedValue({
      incident: {
        incidentId: 'inc-1',
        status: 'investigating',
        totalCostUsd: 0.6,
        costBreakdown: { synthesis: 0.1, codeFixer: 0, orchestrator: 0.5, verification: 0 },
        investigationDurationMs: 12345,
        shadowInvestigationMode: 'debate',
      },
      evidenceByAgent: {},
    });
  });

  it('POST /test/:incidentId returns 200 and calls investigateIncident', async () => {
    const res = await app.request('/test/inc-1', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.investigateIncident.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('incidentId', 'inc-1');
  });

  it('GET /test/:incidentId returns 200 and calls getInvestigation', async () => {
    const res = await app.request('/test/inc-1');

    expect(res.status).toBe(200);
    expect(mockUseCases.getInvestigation.execute).toHaveBeenCalledOnce();
    const body = await res.json() as { incident: Record<string, unknown> };
    expect(body.incident).toHaveProperty('incidentId', 'inc-1');
    // Platform-internal fields must never leak to tenants
    expect(body.incident).not.toHaveProperty('totalCostUsd');
    expect(body.incident).not.toHaveProperty('costBreakdown');
    expect(body.incident).not.toHaveProperty('investigationDurationMs');
    expect(body.incident).not.toHaveProperty('shadowInvestigationMode');
  });

  it('POST /test/:incidentId returns 404 when not found', async () => {
    mockUseCases.investigateIncident.execute.mockRejectedValue(
      new NotFoundError('Incident', 'inc-999'),
    );

    const res = await app.request('/test/inc-999', {
      method: 'POST',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'NOT_FOUND');
  });

  // --- POST /:incidentId/context tests ---

  it('POST /test/:incidentId/context returns result with reinvestigationTriggered', async () => {
    mockUseCases.addInvestigationContext.execute.mockResolvedValue({
      evidenceId: 'ev-1',
      incidentId: 'inc-1',
      reinvestigationTriggered: true,
    });

    const res = await app.request('/test/inc-1/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'We deployed version 2.3.1 right before this started',
        reinvestigate: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.addInvestigationContext.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('reinvestigationTriggered', true);
  });

  it('POST /test/:incidentId/context rejects short context', async () => {
    const res = await app.request('/test/inc-1/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'Hi',
      }),
    });

    expect(res.status).toBe(400);
  });
});
