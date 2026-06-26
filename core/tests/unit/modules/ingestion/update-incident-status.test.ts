import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateIncidentStatusUseCase } from '../../../../src/modules/ingestion/application/update-incident-status.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IncidentStatus } from '../../../../src/shared/domain/types.js';
import { IncidentNotFoundError, InvalidStatusTransitionError } from '../../../../src/modules/ingestion/domain/incident.errors.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

function createMockRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(async (_tid, _iid, status) => ({
      ...baseIncident,
      status,
      updatedAt: new Date().toISOString(),
    })),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

const baseIncident: Incident = {
  incidentId: incidentId('inc-1'),
  tenantId: tenantId('tenant-1'),
  title: 'Test Incident',
  description: 'Test',
  severity: 'high',
  status: 'open',
  sourceProvider: 'datadog',
  sourceAlertId: 'alert-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('UpdateIncidentStatusUseCase', () => {
  let repo: IIncidentRepository;
  let eventBus: EventBus;
  let useCase: UpdateIncidentStatusUseCase;

  beforeEach(() => {
    repo = createMockRepo();
    eventBus = new EventBus();
    useCase = new UpdateIncidentStatusUseCase(repo, eventBus);
  });

  it('should transition from open to triaging', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseIncident, status: 'open' });

    const result = await useCase.execute(tenantId('tenant-1'), incidentId('inc-1'), 'triaging');

    expect(result.status).toBe('triaging');
    expect(repo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'triaging',
      undefined,
    );
  });

  it('should throw InvalidStatusTransitionError for invalid transition', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseIncident, status: 'closed' });

    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('inc-1'), 'open'),
    ).rejects.toThrow(InvalidStatusTransitionError);
  });

  it('should throw IncidentNotFoundError when not found', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('nonexistent'), 'triaging'),
    ).rejects.toThrow(IncidentNotFoundError);
  });

  it('should set resolvedAt when transitioning to resolved', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseIncident, status: 'investigating' });

    await useCase.execute(tenantId('tenant-1'), incidentId('inc-1'), 'resolved');

    const call = vi.mocked(repo.updateStatus).mock.calls[0];
    expect(call?.[2]).toBe('resolved');
    expect(call?.[3]).toBeTruthy(); // resolvedAt should be set
  });

  it('should publish incident.status_changed event', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseIncident, status: 'open' });
    const handler = vi.fn();
    eventBus.subscribe('incident.status_changed', handler);

    await useCase.execute(tenantId('tenant-1'), incidentId('inc-1'), 'triaging');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'incident.status_changed',
      payload: { incidentId: 'inc-1', from: 'open', to: 'triaging' },
    });
  });

  it.each([
    ['open', 'triaging'],
    ['open', 'closed'],
    ['triaging', 'investigating'],
    ['triaging', 'closed'],
    ['triaging', 'resolved'],
    ['investigating', 'awaiting_approval'],
    ['investigating', 'resolved'],
    ['investigating', 'closed'],
    ['awaiting_approval', 'remediating'],
    ['awaiting_approval', 'investigating'],
    ['remediating', 'resolved'],
    ['remediating', 'closed'],
    ['resolved', 'closed'],
  ])('should allow transition from %s to %s', async (from, to) => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseIncident, status: from as IncidentStatus });
    const result = await useCase.execute(tenantId('tenant-1'), incidentId('inc-1'), to as IncidentStatus);
    expect(result.status).toBe(to);
  });

  it.each([
    ['open', 'investigating'],
    ['open', 'resolved'],
    ['open', 'awaiting_approval'],
    ['open', 'remediating'],
    ['triaging', 'remediating'],
    ['triaging', 'awaiting_approval'],
    ['resolved', 'open'],
    ['resolved', 'investigating'],
    ['resolved', 'triaging'],
    ['closed', 'open'],
    ['closed', 'triaging'],
    ['closed', 'investigating'],
  ])('should reject illegal transition from %s to %s', async (from, to) => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseIncident, status: from as IncidentStatus });
    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('inc-1'), to as IncidentStatus),
    ).rejects.toThrow(InvalidStatusTransitionError);
  });
});
