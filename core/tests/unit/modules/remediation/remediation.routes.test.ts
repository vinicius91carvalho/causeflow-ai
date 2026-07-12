import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createTestApp } from '../../../helpers/test-app.js';
import {
  createRemediationRoutes,
  type RemediationUseCases,
} from '../../../../src/modules/remediation/infra/remediation.routes.js';

const mockUseCases = {
  proposeRemediation: {
    execute: vi.fn().mockResolvedValue({ remediationId: 'rem-1', status: 'proposed' }),
  },
  approveRemediation: {
    execute: vi.fn().mockResolvedValue({ status: 'approved' }),
  },
  rejectRemediation: {
    execute: vi.fn().mockResolvedValue({ status: 'rejected' }),
  },
  executeRemediation: {
    execute: vi.fn().mockResolvedValue({ status: 'executing' }),
  },
  rollbackRemediation: {
    execute: vi.fn().mockResolvedValue({
      remediationId: 'rem-rollback',
      status: 'proposed',
      rollbackOf: 'rem-1',
    }),
  },
  getRemediation: {
    listByIncident: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({ remediationId: 'rem-1' }),
  },
};

const app = createTestApp(createRemediationRoutes, mockUseCases as unknown as RemediationUseCases);

describe('remediation.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCases.proposeRemediation.execute.mockResolvedValue({
      remediationId: 'rem-1',
      status: 'proposed',
    });
    mockUseCases.approveRemediation.execute.mockResolvedValue({ status: 'approved' });
    mockUseCases.rejectRemediation.execute.mockResolvedValue({ status: 'rejected' });
    mockUseCases.executeRemediation.execute.mockResolvedValue({ status: 'executing' });
    mockUseCases.rollbackRemediation.execute.mockResolvedValue({
      remediationId: 'rem-rollback',
      status: 'proposed',
      rollbackOf: 'rem-1',
    });
    mockUseCases.getRemediation.listByIncident.mockResolvedValue([]);
    mockUseCases.getRemediation.getById.mockResolvedValue({ remediationId: 'rem-1' });
  });

  it('POST /test with valid body returns 201', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId: 'inc-1',
        rootCause: 'Memory leak',
        recommendedActions: [{ action: 'restart', params: {} }],
      }),
    });

    expect(res.status).toBe(201);
    expect(mockUseCases.proposeRemediation.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('remediationId', 'rem-1');
    expect(body).toHaveProperty('status', 'proposed');
  });

  it('GET /test/:incidentId returns 200 and calls listByIncident', async () => {
    const res = await app.request('/test/inc-1');

    expect(res.status).toBe(200);
    expect(mockUseCases.getRemediation.listByIncident).toHaveBeenCalledOnce();
  });

  it('GET /test/detail/:remediationId returns 200 and calls getById', async () => {
    const res = await app.request('/test/detail/rem-1');

    expect(res.status).toBe(200);
    expect(mockUseCases.getRemediation.getById).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('remediationId', 'rem-1');
  });

  it('POST /test/:remediationId/approve returns 200', async () => {
    const res = await app.request('/test/rem-1/approve', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.approveRemediation.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('status', 'approved');
  });

  it('POST /test/:remediationId/reject with reason returns 200', async () => {
    const res = await app.request('/test/rem-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'not needed' }),
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.rejectRemediation.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('status', 'rejected');
  });

  it('POST /test/:remediationId/execute returns 200', async () => {
    const res = await app.request('/test/rem-1/execute', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(mockUseCases.executeRemediation.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('status', 'executing');
  });

  it('POST /test/:remediationId/rollback returns 201', async () => {
    const res = await app.request('/test/rem-1/rollback', {
      method: 'POST',
    });

    expect(res.status).toBe(201);
    expect(mockUseCases.rollbackRemediation.execute).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body).toHaveProperty('remediationId', 'rem-rollback');
    expect(body).toHaveProperty('rollbackOf', 'rem-1');
  });

  it('POST /test with invalid body (missing fields) returns 400', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: 'inc-1' }),
    });

    expect(res.status).toBe(400);
  });
});
