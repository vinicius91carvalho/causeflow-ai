import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleInvestigationBullJob } from '../../../src/workers/investigation-bull-job-handler.js';
import { IncidentNotInvestigatableError } from '../../../src/modules/investigation/domain/investigation.errors.js';
import type { IIncidentRepository } from '../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../src/modules/ingestion/domain/incident.entity.js';
import { tenantId, incidentId } from '../../../src/shared/domain/value-objects.js';

vi.mock('../../../src/shared/infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    incidentId: incidentId('inc-ac060'),
    tenantId: tenantId('tenant-ac060'),
    title: 'pool exhausted',
    description: 'order-service connection pool exhausted — causeflow-test-app evidence',
    severity: 'critical',
    status: 'awaiting_approval',
    sourceProvider: 'stub',
    sourceAlertId: 'stub-1',
    rootCause: 'Connection pool exhausted in order-service (causeflow-test-app)',
    createdAt: '2026-07-11T00:00:00Z',
    updatedAt: '2026-07-11T00:00:00Z',
    ...overrides,
  };
}

describe('handleInvestigationBullJob (AC-060)', () => {
  const execute = vi.fn();
  const findById = vi.fn();
  const update = vi.fn();
  const updateStatus = vi.fn();

  const deps = {
    investigateIncident: { execute },
    incidentRepo: {
      findById,
      update,
      updateStatus,
    } as unknown as IIncidentRepository,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips investigateIncident.execute for mode:followup on awaiting_approval', async () => {
    findById.mockResolvedValue(incident());

    await handleInvestigationBullJob(
      {
        tenantId: 'tenant-ac060',
        incidentId: 'inc-ac060',
        mode: 'followup',
        suggestedAgents: [],
      },
      deps,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('skips execute when incident status is already terminal', async () => {
    findById.mockResolvedValue(incident({ status: 'awaiting_approval' }));

    await handleInvestigationBullJob(
      {
        tenantId: 'tenant-ac060',
        incidentId: 'inc-ac060',
        mode: 'investigate',
      },
      deps,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not clobber rootCause when execute throws IncidentNotInvestigatableError', async () => {
    findById.mockResolvedValue(incident({ status: 'triaging' }));
    execute.mockRejectedValue(new IncidentNotInvestigatableError('inc-ac060', 'awaiting_approval'));

    await handleInvestigationBullJob(
      {
        tenantId: 'tenant-ac060',
        incidentId: 'inc-ac060',
        mode: 'investigate',
      },
      deps,
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('runs investigate for normal investigate jobs on triaging incidents', async () => {
    findById.mockResolvedValue(incident({ status: 'triaging', rootCause: undefined }));
    execute.mockResolvedValue(undefined);

    await handleInvestigationBullJob(
      {
        tenantId: 'tenant-ac060',
        incidentId: 'inc-ac060',
        mode: 'investigate',
        suggestedAgents: ['log_analyst'],
      },
      deps,
    );

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]![0].suggestedAgents).toEqual(['log_analyst']);
  });
});
