import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { TimeoutStaleRemediationsUseCase } from '../../../../src/modules/remediation/application/timeout-stale-remediations.usecase.js';
import type { IRemediationRepository } from '../../../../src/modules/remediation/domain/remediation.repository.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Remediation } from '../../../../src/modules/remediation/domain/remediation.entity.js';
import { tenantId, incidentId, remediationId } from '../../../../src/shared/domain/value-objects.js';

const now = Date.now();
const TWENTY_FIVE_HOURS_AGO = new Date(now - 25 * 60 * 60 * 1000).toISOString();
const ONE_HOUR_AGO = new Date(now - 1 * 60 * 60 * 1000).toISOString();

function makeRemediation(overrides: Partial<Remediation> = {}): Remediation {
  return {
    remediationId: remediationId('rem-1'),
    tenantId: tenantId('tenant-1'),
    incidentId: incidentId('inc-1'),
    status: 'proposed',
    description: 'Fix it',
    rootCause: 'Memory leak',
    steps: [{ stepIndex: 0, action: 'restart', label: 'Restart service', description: 'Restarts the affected service', riskLevel: 'low', automated: true, params: {}, status: 'pending' }],
    proposedBy: 'system',
    createdAt: TWENTY_FIVE_HOURS_AGO,
    updatedAt: TWENTY_FIVE_HOURS_AGO,
    ...overrides,
  };
}

function createMockRemediationRepo(): IRemediationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIncident: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  };
}

function createMockIncidentRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceAlert: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue({}),
    listByTenant: vi.fn(),
    findBySeverity: vi.fn(),
    findByStatus: vi.fn(),
    listByCreatedAt: vi.fn(),
    findAll: vi.fn(),
  };
}

describe('TimeoutStaleRemediationsUseCase', () => {
  let remediationRepo: IRemediationRepository;
  let incidentRepo: IIncidentRepository;
  let useCase: TimeoutStaleRemediationsUseCase;

  beforeEach(() => {
    remediationRepo = createMockRemediationRepo();
    incidentRepo = createMockIncidentRepo();
    useCase = new TimeoutStaleRemediationsUseCase(remediationRepo, incidentRepo);
  });

  it('should reject stale proposed remediations older than 24h', async () => {
    const staleRemediation = makeRemediation({ createdAt: TWENTY_FIVE_HOURS_AGO });
    vi.mocked(remediationRepo.findByIncident).mockResolvedValue([staleRemediation]);

    const result = await useCase.execute({
      tenantIds: [tenantId('tenant-1')],
      incidentIds: [incidentId('inc-1')],
    });

    expect(result.rejected).toBe(1);
    expect(result.errors).toBe(0);
    expect(remediationRepo.update).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      remediationId('rem-1'),
      expect.objectContaining({
        status: 'rejected',
        rejectedBy: 'system-timeout',
      }),
    );
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-1'),
      'investigating',
    );
  });

  it('should not reject recent proposed remediations', async () => {
    const recentRemediation = makeRemediation({ createdAt: ONE_HOUR_AGO });
    vi.mocked(remediationRepo.findByIncident).mockResolvedValue([recentRemediation]);

    const result = await useCase.execute({
      tenantIds: [tenantId('tenant-1')],
      incidentIds: [incidentId('inc-1')],
    });

    expect(result.rejected).toBe(0);
    expect(remediationRepo.update).not.toHaveBeenCalled();
  });

  it('should not reject remediations in non-proposed status', async () => {
    const approvedRemediation = makeRemediation({ status: 'approved', createdAt: TWENTY_FIVE_HOURS_AGO });
    vi.mocked(remediationRepo.findByIncident).mockResolvedValue([approvedRemediation]);

    const result = await useCase.execute({
      tenantIds: [tenantId('tenant-1')],
      incidentIds: [incidentId('inc-1')],
    });

    expect(result.rejected).toBe(0);
  });

  it('should handle update errors gracefully', async () => {
    const staleRemediation = makeRemediation({ createdAt: TWENTY_FIVE_HOURS_AGO });
    vi.mocked(remediationRepo.findByIncident).mockResolvedValue([staleRemediation]);
    vi.mocked(remediationRepo.update).mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute({
      tenantIds: [tenantId('tenant-1')],
      incidentIds: [incidentId('inc-1')],
    });

    expect(result.rejected).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('should handle findByIncident errors gracefully', async () => {
    vi.mocked(remediationRepo.findByIncident).mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute({
      tenantIds: [tenantId('tenant-1')],
      incidentIds: [incidentId('inc-1')],
    });

    expect(result.rejected).toBe(0);
    expect(result.errors).toBe(1);
  });
});
