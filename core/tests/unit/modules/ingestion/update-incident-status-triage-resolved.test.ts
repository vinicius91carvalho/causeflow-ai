/**
 * State-machine edge test: triaging → resolved
 *
 * Verifies that after adding 'resolved' to the triaging allow-list:
 *   - The transition succeeds
 *   - resolvedAt is stamped
 *   - incident.status_changed event is published with correct from/to
 */
import { describe, it, expect, vi } from 'vitest';
import { UpdateIncidentStatusUseCase } from '../../../../src/modules/ingestion/application/update-incident-status.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

const TID = tenantId('tenant-1');
const IID = incidentId('inc-1');

const baseIncident: Incident = {
  incidentId: IID,
  tenantId: TID,
  title: 'Test Incident',
  description: 'Test',
  severity: 'low',
  status: 'triaging',
  sourceProvider: 'datadog',
  sourceAlertId: 'alert-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function createMockRepo(incident: Incident): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(incident),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(async (_tid, _iid, status, resolvedAt) => ({
      ...incident,
      status,
      resolvedAt,
      updatedAt: new Date().toISOString(),
    }) as Incident),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

describe('UpdateIncidentStatusUseCase — triaging → resolved (new transition)', () => {
  it('should allow triaging → resolved and stamp resolvedAt', async () => {
    const repo = createMockRepo({ ...baseIncident, status: 'triaging' });
    const eventBus = new EventBus();
    const useCase = new UpdateIncidentStatusUseCase(repo, eventBus);

    const result = await useCase.execute(TID, IID, 'resolved');

    expect(result.status).toBe('resolved');

    // resolvedAt must be stamped
    const updateStatusCall = vi.mocked(repo.updateStatus).mock.calls[0];
    expect(updateStatusCall?.[2]).toBe('resolved');
    expect(updateStatusCall?.[3]).toBeTruthy(); // resolvedAt non-empty
  });

  it('should publish incident.status_changed with from=triaging to=resolved', async () => {
    const repo = createMockRepo({ ...baseIncident, status: 'triaging' });
    const eventBus = new EventBus();
    const useCase = new UpdateIncidentStatusUseCase(repo, eventBus);

    const handler = vi.fn();
    eventBus.subscribe('incident.status_changed', handler);

    await useCase.execute(TID, IID, 'resolved');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'incident.status_changed',
      payload: {
        incidentId: 'inc-1',
        from: 'triaging',
        to: 'resolved',
      },
    });
  });
});
