import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/llm/llm-factory.js', () => ({
  isLocalLlmFailClosedMode: () => true,
}));

vi.mock('../../../../src/shared/infra/llm/local-llm-guard.js', () => ({
  LOCAL_LLM_UNAVAILABLE_MESSAGE: 'Local LLM connector unavailable',
  assertLocalLlmReachable: vi.fn().mockRejectedValue(new Error('Local LLM connector unavailable')),
}));

import { InvestigateIncidentUseCase } from '../../../../src/modules/investigation/application/investigate-incident.usecase.js';
import { InvestigationFailedError } from '../../../../src/modules/investigation/domain/investigation.errors.js';
import type { IIncidentRepository } from '../../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository } from '../../../../src/modules/triage/domain/evidence.repository.js';
import type { IToolCallRepository } from '../../../../src/modules/triage/domain/tool-call.repository.js';
import type { AgentRunner } from '../../../../src/shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../../src/shared/application/ports/credential-vendor.port.js';
import { EventBus } from '../../../../src/shared/domain/events.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';

function createMockIncident(): Incident {
  return {
    incidentId: incidentId('inc-123'),
    tenantId: tenantId('tenant-1'),
    title: 'High CPU on api-server',
    description: 'CPU usage at 95% for 10 minutes',
    severity: 'critical',
    status: 'triaging',
    sourceProvider: 'datadog',
    sourceAlertId: 'dd-alert-456',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('InvestigateIncidentUseCase fail-closed (AC-055)', () => {
  const incidentRepo = {
    findById: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
  } as unknown as IIncidentRepository;

  const evidenceRepo = {
    create: vi.fn(),
    findByIncident: vi.fn().mockResolvedValue([]),
  } as unknown as IEvidenceRepository;

  const toolCallRepo = {} as IToolCallRepository;
  const agentRunner = { run: vi.fn() } as unknown as AgentRunner;
  const llmClient = { complete: vi.fn() } as unknown as LLMClient;
  const cloudProvider = {} as CloudProvider;
  const credentialVendor = { vend: vi.fn() } as unknown as CredentialVendor;

  const useCase = new InvestigateIncidentUseCase({
    incidentRepo,
    evidenceRepo,
    toolCallRepo,
    eventBus: new EventBus(),
    agentRunner,
    llmClient,
    cloudProvider,
    credentialVendor,
    toolHandlerFactory: () => async () => 'ok',
  });

  beforeEach(() => {
    vi.mocked(incidentRepo.findById).mockResolvedValue(createMockIncident());
  });

  it('fails before running stub agents when local LLM probe fails', async () => {
    await expect(
      useCase.execute({
        tenantId: tenantId('tenant-1'),
        incidentId: incidentId('inc-123'),
        suggestedAgents: ['log_analyst'],
      }),
    ).rejects.toBeInstanceOf(InvestigationFailedError);

    expect(agentRunner.run).not.toHaveBeenCalled();
  });
});
