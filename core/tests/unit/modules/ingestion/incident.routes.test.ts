import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import { createIncidentRoutes, type IncidentUseCases } from '../../../../src/modules/ingestion/infra/incident.routes.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';

const mockUseCases = {
  getIncident: { execute: vi.fn() },
  listIncidents: { execute: vi.fn().mockResolvedValue({ items: [], cursor: undefined }) },
  updateIncidentStatus: { execute: vi.fn() },
  createManualIncident: { execute: vi.fn() },
  incidentRepo: {
    findBySeverity: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
    findByStatus: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
    listByCreatedAt: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
  },
};

const app = createTestApp(createIncidentRoutes, mockUseCases as unknown as IncidentUseCases);

describe('incident.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.getIncident.execute.mockResolvedValue({
      incidentId: 'inc-1',
      title: 'High CPU',
      status: 'open',
    });
    mockUseCases.listIncidents.execute.mockResolvedValue({
      items: [],
      cursor: undefined,
    });
    mockUseCases.updateIncidentStatus.execute.mockResolvedValue({
      incidentId: 'inc-1',
      status: 'triaging',
    });
  });

  it('GET /test returns 200 and calls listByCreatedAt', async () => {
    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(mockUseCases.incidentRepo.listByCreatedAt).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('items');
  });

  it('GET /test/:id returns 200 and calls getIncident', async () => {
    const res = await app.request('/test/inc-1');

    expect(res.status).toBe(200);
    expect(mockUseCases.getIncident.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('incidentId', 'inc-1');
  });

  it('GET /test/:id returns 404 when not found', async () => {
    mockUseCases.getIncident.execute.mockRejectedValue(
      new NotFoundError('Incident', 'inc-999'),
    );

    const res = await app.request('/test/inc-999');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'NOT_FOUND');
  });

  it('GET /test/:id returns status and resolution verbatim for inconclusive incident', async () => {
    const inconclusiveIncident = {
      incidentId: 'inc-42',
      tenantId: 'tenant-1',
      title: 'Mystery CPU spike',
      status: 'inconclusive' as const,
      resolution: 'inconclusive: no root cause identified after exhaustive agent investigation',
      severity: 'high',
      sourceProvider: 'datadog',
      sourceAlertId: 'alert-42',
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T01:00:00.000Z',
      // internal fields that must be stripped
      totalCostUsd: 0.71,
      costBreakdown: { synthesis: 0.5, codeFixer: 0.21 },
      investigationDurationMs: 180000,
    };
    mockUseCases.getIncident.execute.mockResolvedValue(inconclusiveIncident);

    const res = await app.request('/test/inc-42');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'inconclusive');
    expect(body).toHaveProperty('resolution', 'inconclusive: no root cause identified after exhaustive agent investigation');
    // internal accounting fields must not leak to tenant
    expect(body).not.toHaveProperty('totalCostUsd');
    expect(body).not.toHaveProperty('costBreakdown');
    expect(body).not.toHaveProperty('investigationDurationMs');
  });

  it('PATCH /test/:id with valid status returns 200', async () => {
    const res = await app.request('/test/inc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'triaging' }),
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.updateIncidentStatus.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('status', 'triaging');
  });

  it('PATCH /test/:id with invalid status returns 400', async () => {
    const res = await app.request('/test/inc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid_status' }),
    });

    expect(res.status).toBe(400);
  });

  // --- POST /chat tests ---

  it('POST /test/chat returns 201 and calls createManualIncident', async () => {
    mockUseCases.createManualIncident.execute.mockResolvedValue({
      incidentId: 'inc-new',
      status: 'triaging',
    });

    const res = await app.request('/test/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'API is down',
        description: 'The API is returning 500 errors continuously',
        severity: 'high',
      }),
    });

    expect(res.status).toBe(201);
    expect(mockUseCases.createManualIncident.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('incidentId', 'inc-new');
    expect(body).toHaveProperty('status', 'triaging');
  });

  it('POST /test/chat rejects short title', async () => {
    const res = await app.request('/test/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Hi',
        description: 'Some description that is long enough',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /test/chat rejects short description', async () => {
    const res = await app.request('/test/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Valid title here',
        description: 'Short',
      }),
    });

    expect(res.status).toBe(400);
  });
});
