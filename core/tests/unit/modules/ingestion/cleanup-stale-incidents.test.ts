import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { CleanupStaleIncidentsUseCase } from '../../../../src/modules/ingestion/application/cleanup-stale-incidents.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

const now = Date.now();
const TWENTY_FIVE_HOURS_AGO = new Date(now - 25 * 60 * 60 * 1000).toISOString();
const ONE_HOUR_AGO = new Date(now - 1 * 60 * 60 * 1000).toISOString();

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    incidentId: incidentId('inc-1'),
    tenantId: tenantId('tenant-1'),
    title: 'Test',
    description: 'test',
    severity: 'medium',
    status: 'triaging',
    sourceProvider: 'datadog',
    sourceAlertId: 'alert-1',
    createdAt: TWENTY_FIVE_HOURS_AGO,
    updatedAt: TWENTY_FIVE_HOURS_AGO,
    ...overrides,
  };
}

function createMockRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue({}),
    listByTenant: vi.fn().mockResolvedValue({ items: [], cursor: undefined }),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

describe('CleanupStaleIncidentsUseCase', () => {
  let repo: IIncidentRepository;
  let useCase: CleanupStaleIncidentsUseCase;

  beforeEach(() => {
    repo = createMockRepo();
    useCase = new CleanupStaleIncidentsUseCase(repo);
  });

  it('should close stale triaging incidents older than 24h', async () => {
    const staleIncident = makeIncident({ status: 'triaging', updatedAt: TWENTY_FIVE_HOURS_AGO });
    vi.mocked(repo.listByTenant).mockResolvedValue({ items: [staleIncident], cursor: undefined });

    const result = await useCase.execute({ tenantIds: [tenantId('tenant-1')] });

    expect(result.closed).toBe(1);
    expect(result.errors).toBe(0);
    expect(repo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      staleIncident.incidentId,
      'closed',
    );
  });

  it('should close stale investigating incidents older than 24h', async () => {
    const staleIncident = makeIncident({ status: 'investigating', updatedAt: TWENTY_FIVE_HOURS_AGO });
    vi.mocked(repo.listByTenant).mockResolvedValue({ items: [staleIncident], cursor: undefined });

    const result = await useCase.execute({ tenantIds: [tenantId('tenant-1')] });

    expect(result.closed).toBe(1);
  });

  it('should not close incidents that are not stale', async () => {
    const recentIncident = makeIncident({ status: 'triaging', updatedAt: ONE_HOUR_AGO });
    vi.mocked(repo.listByTenant).mockResolvedValue({ items: [recentIncident], cursor: undefined });

    const result = await useCase.execute({ tenantIds: [tenantId('tenant-1')] });

    expect(result.closed).toBe(0);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('should not close incidents in resolved status', async () => {
    const resolvedIncident = makeIncident({ status: 'resolved', updatedAt: TWENTY_FIVE_HOURS_AGO });
    vi.mocked(repo.listByTenant).mockResolvedValue({ items: [resolvedIncident], cursor: undefined });

    const result = await useCase.execute({ tenantIds: [tenantId('tenant-1')] });

    expect(result.closed).toBe(0);
  });

  it('should handle updateStatus errors gracefully', async () => {
    const staleIncident = makeIncident({ status: 'triaging', updatedAt: TWENTY_FIVE_HOURS_AGO });
    vi.mocked(repo.listByTenant).mockResolvedValue({ items: [staleIncident], cursor: undefined });
    vi.mocked(repo.updateStatus).mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute({ tenantIds: [tenantId('tenant-1')] });

    expect(result.closed).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('should handle listByTenant errors gracefully', async () => {
    vi.mocked(repo.listByTenant).mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute({ tenantIds: [tenantId('tenant-1')] });

    expect(result.closed).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('should process multiple tenants', async () => {
    const stale1 = makeIncident({ incidentId: incidentId('inc-1'), tenantId: tenantId('t1'), status: 'triaging', updatedAt: TWENTY_FIVE_HOURS_AGO });
    const stale2 = makeIncident({ incidentId: incidentId('inc-2'), tenantId: tenantId('t2'), status: 'investigating', updatedAt: TWENTY_FIVE_HOURS_AGO });

    vi.mocked(repo.listByTenant)
      .mockResolvedValueOnce({ items: [stale1], cursor: undefined })
      .mockResolvedValueOnce({ items: [stale2], cursor: undefined });

    const result = await useCase.execute({ tenantIds: [tenantId('t1'), tenantId('t2')] });

    expect(result.closed).toBe(2);
  });
});
