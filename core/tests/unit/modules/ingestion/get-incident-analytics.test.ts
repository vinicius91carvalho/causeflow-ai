import { describe, it, expect, vi } from 'vitest';
import { GetIncidentAnalyticsUseCase } from '../../../../src/modules/ingestion/application/get-incident-analytics.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    incidentId: incidentId('inc-1'),
    tenantId: tenantId('tenant-1'),
    title: 'Test incident',
    description: 'desc',
    severity: 'high',
    status: 'open',
    sourceProvider: 'datadog',
    sourceAlertId: 'alert-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMockRepo(incidents: Incident[]): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(async () => incidents),
  };
}

describe('GetIncidentAnalyticsUseCase', () => {
  it('should return analytics with totals and breakdowns', async () => {
    const incidents = [
      makeIncident({ incidentId: incidentId('inc-1'), status: 'open', severity: 'high' }),
      makeIncident({ incidentId: incidentId('inc-2'), status: 'investigating', severity: 'critical' }),
      makeIncident({
        incidentId: incidentId('inc-3'),
        status: 'resolved',
        severity: 'medium',
        createdAt: '2024-01-01T00:00:00.000Z',
        resolvedAt: '2024-01-01T01:00:00.000Z',
      }),
    ];

    const repo = createMockRepo(incidents);
    const useCase = new GetIncidentAnalyticsUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result.total).toBe(3);
    expect(result.byStatus).toEqual({ open: 1, investigating: 1, resolved: 1 });
    expect(result.bySeverity).toEqual({ high: 1, critical: 1, medium: 1 });
    expect(result.openCount).toBe(2); // open + investigating
    expect(result.mttrMinutes).toBe(60); // 1 hour = 60 minutes
  });

  it('should return null MTTR when no resolved incidents', async () => {
    const incidents = [
      makeIncident({ status: 'open' }),
    ];

    const repo = createMockRepo(incidents);
    const useCase = new GetIncidentAnalyticsUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result.mttrMinutes).toBeNull();
    expect(result.openCount).toBe(1);
  });

  it('should handle empty incident list', async () => {
    const repo = createMockRepo([]);
    const useCase = new GetIncidentAnalyticsUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result.total).toBe(0);
    expect(result.byStatus).toEqual({});
    expect(result.bySeverity).toEqual({});
    expect(result.mttrMinutes).toBeNull();
    expect(result.openCount).toBe(0);
  });

  it('should count triaging status as open', async () => {
    const incidents = [
      makeIncident({ status: 'triaging' }),
    ];

    const repo = createMockRepo(incidents);
    const useCase = new GetIncidentAnalyticsUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result.openCount).toBe(1);
  });

  it('should calculate average MTTR from multiple resolved incidents', async () => {
    const incidents = [
      makeIncident({
        incidentId: incidentId('inc-1'),
        status: 'resolved',
        createdAt: '2024-01-01T00:00:00.000Z',
        resolvedAt: '2024-01-01T01:00:00.000Z', // 60 min
      }),
      makeIncident({
        incidentId: incidentId('inc-2'),
        status: 'resolved',
        createdAt: '2024-01-01T00:00:00.000Z',
        resolvedAt: '2024-01-01T02:00:00.000Z', // 120 min
      }),
    ];

    const repo = createMockRepo(incidents);
    const useCase = new GetIncidentAnalyticsUseCase(repo);
    const result = await useCase.execute(tenantId('tenant-1'));

    expect(result.mttrMinutes).toBe(90); // (60+120)/2
  });
});
