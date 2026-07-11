import { v4 as uuidv4 } from 'uuid';
import { evidenceId } from '../../../shared/domain/value-objects.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
import type { IIntegrationRepository } from '../domain/integration.repository.js';

export interface PersistStubProbeEvidenceInput {
  tenantId: TenantId;
  incidentId: IncidentId;
}

export interface PersistStubProbeEvidenceOutput {
  persisted: boolean;
  source?: string;
}

/**
 * Pull deterministic probe evidence from the stub upstream and persist it on the
 * incident (AC-057 capstone — evidence attributable to stub-upstream).
 */
export class PersistStubProbeEvidenceUseCase {
  constructor(
    private readonly integrationRepo: IIntegrationRepository,
    private readonly evidenceRepo: IEvidenceRepository,
  ) {}

  async execute(input: PersistStubProbeEvidenceInput): Promise<PersistStubProbeEvidenceOutput> {
    const integration = await this.integrationRepo.findByProvider(input.tenantId, 'stub-upstream');
    if (!integration) {
      return { persisted: false };
    }

    const stubBaseUrl = String(integration.config['stubBaseUrl'] ?? '').replace(/\/$/, '');
    if (!stubBaseUrl) {
      return { persisted: false };
    }

    const res = await fetch(`${stubBaseUrl}/v1/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: String(input.tenantId) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      return { persisted: false };
    }

    const stubEvidence = body['evidence'] as Record<string, unknown> | undefined;
    if (!stubEvidence) {
      return { persisted: false };
    }

    const source = String(stubEvidence['source'] ?? 'stub-upstream');
    const metric = String(stubEvidence['metric'] ?? 'cpu.utilization');
    const value = stubEvidence['value'];
    const service = String(stubEvidence['service'] ?? 'order-service');
    const message = String(stubEvidence['message'] ?? 'Stub upstream probe evidence');

    await this.evidenceRepo.create({
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      evidenceId: evidenceId(uuidv4()),
      agentRole: 'scout',
      evidenceType: 'metric_snapshot',
      content: `${message}\n\nMetric: ${metric}=${value} service=${service}`,
      metadata: {
        source,
        label: 'Stub upstream probe',
        category: 'stub_connector',
        toolName: 'stub_probe',
      },
      createdAt: new Date().toISOString(),
    });

    return { persisted: true, source };
  }
}
