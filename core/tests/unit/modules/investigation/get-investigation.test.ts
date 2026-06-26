import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInvestigationUseCase } from '../../../../src/modules/investigation/application/get-investigation.usecase.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository, Evidence } from '../../../../src/modules/triage/domain/evidence.repository.js';
import { tenantId, incidentId, evidenceId } from '../../../../src/shared/domain/value-objects.js';
import { NotFoundError } from '../../../../src/shared/domain/errors.js';

function createMockIncident(): Incident {
  return {
    incidentId: incidentId('inc-123'),
    tenantId: tenantId('tenant-1'),
    title: 'High CPU on api-server',
    description: 'CPU usage at 95%',
    severity: 'critical',
    status: 'investigating',
    sourceProvider: 'datadog',
    sourceAlertId: 'dd-456',
    rootCause: 'Memory leak in connection pool',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function createMockEvidence(): Evidence[] {
  return [
    {
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      evidenceId: evidenceId('ev-1'),
      agentRole: 'log_analyst',
      evidenceType: 'agent_reasoning',
      content: 'Found OOM errors in logs',
      createdAt: '2024-01-01T00:01:00Z',
    },
    {
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      evidenceId: evidenceId('ev-2'),
      agentRole: 'metric_analyst',
      evidenceType: 'agent_reasoning',
      content: 'CPU spike from 35% to 95%',
      createdAt: '2024-01-01T00:01:00Z',
    },
    {
      tenantId: tenantId('tenant-1'),
      incidentId: incidentId('inc-123'),
      evidenceId: evidenceId('ev-3'),
      agentRole: 'coordinator',
      evidenceType: 'agent_reasoning',
      content: 'Root cause synthesis',
      createdAt: '2024-01-01T00:02:00Z',
    },
  ];
}

describe('GetInvestigationUseCase', () => {
  let incidentRepo: IIncidentRepository;
  let evidenceRepo: IEvidenceRepository;
  let useCase: GetInvestigationUseCase;

  beforeEach(() => {
    incidentRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySourceAlert: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      listByTenant: vi.fn(),
      findBySeverity: vi.fn(),
      findByStatus: vi.fn(),
      listByCreatedAt: vi.fn(),
      findAll: vi.fn(),
    };
    evidenceRepo = {
      create: vi.fn(),
      findByIncident: vi.fn(),
      listByAgentRole: vi.fn(),
    };
    useCase = new GetInvestigationUseCase(incidentRepo, evidenceRepo);
  });

  it('should return incident with evidence grouped by agent role', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());
    vi.mocked(evidenceRepo.findByIncident).mockResolvedValueOnce(createMockEvidence());

    const result = await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    expect(result.incident.title).toBe('High CPU on api-server');
    expect(result.incident.rootCause).toBe('Memory leak in connection pool');

    expect(Object.keys(result.evidenceByAgent)).toHaveLength(3);
    expect(result.evidenceByAgent['log_analyst']).toHaveLength(1);
    expect(result.evidenceByAgent['metric_analyst']).toHaveLength(1);
    expect(result.evidenceByAgent['coordinator']).toHaveLength(1);
  });

  it('should throw NotFoundError when incident does not exist', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('inc-999')),
    ).rejects.toThrow(NotFoundError);
  });

  it('should return empty evidenceByAgent when no evidence exists', async () => {
    vi.mocked(incidentRepo.findById).mockResolvedValueOnce(createMockIncident());
    vi.mocked(evidenceRepo.findByIncident).mockResolvedValueOnce([]);

    const result = await useCase.execute(tenantId('tenant-1'), incidentId('inc-123'));

    expect(result.incident).toBeDefined();
    expect(Object.keys(result.evidenceByAgent)).toHaveLength(0);
  });
});
