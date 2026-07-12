import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/llm/llm-factory.js', () => ({
  isLocalLlmFailClosedMode: () => true,
}));

import { TriageIncidentUseCase } from '../../../../src/modules/triage/application/triage-incident.usecase.js';
import { TriageFailedError } from '../../../../src/modules/triage/domain/triage.errors.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository } from '../../../../src/modules/triage/domain/evidence.repository.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

function createMockIncident(): Incident {
  return {
    incidentId: incidentId('inc-123'),
    tenantId: tenantId('tenant-1'),
    title: 'High CPU on api-server',
    description: 'CPU usage at 95% for 10 minutes',
    severity: 'critical',
    status: 'open',
    sourceProvider: 'datadog',
    sourceAlertId: 'dd-alert-456',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('TriageIncidentUseCase fail-closed (AC-055)', () => {
  const incidentRepo = {
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
  } as unknown as IIncidentRepository;

  const evidenceRepo = {
    create: vi.fn(),
    findByIncident: vi.fn(),
    listByAgentRole: vi.fn(),
  } as unknown as IEvidenceRepository;

  const llmClient = {
    complete: vi.fn(),
  } as unknown as LLMClient;

  const useCase = new TriageIncidentUseCase(incidentRepo, evidenceRepo, new EventBus(), llmClient);

  beforeEach(() => {
    vi.mocked(incidentRepo.findById).mockResolvedValue(createMockIncident());
    vi.mocked(incidentRepo.updateStatus).mockResolvedValue(createMockIncident());
    vi.mocked(llmClient.complete).mockRejectedValue(new Error('connection refused'));
  });

  it('fails closed instead of using deterministic fallback when local LLM is down', async () => {
    await expect(
      useCase.execute(tenantId('tenant-1'), incidentId('inc-123')),
    ).rejects.toBeInstanceOf(TriageFailedError);

    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      tenantId('tenant-1'),
      incidentId('inc-123'),
      'failed',
    );
  });
});
