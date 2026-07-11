import { ValidationError } from '../../../shared/domain/errors.js';
import { config } from '../../../shared/config/index.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IIntegrationRepository } from '../domain/integration.repository.js';

export interface IngestViaStubIntegrationInput {
  tenantId: TenantId;
  title?: string;
  description?: string;
  priority?: string;
}

export interface IngestViaStubIntegrationOutput {
  emitted: boolean;
  incidentId?: string;
  stubState: Record<string, unknown>;
  ingestedAt: string;
}

export class IngestViaStubIntegrationUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(input: IngestViaStubIntegrationInput): Promise<IngestViaStubIntegrationOutput> {
    const integration = await this.integrationRepo.findByProvider(input.tenantId, 'stub-upstream');
    if (!integration) {
      throw new ValidationError('Stub upstream integration is not connected for this tenant');
    }

    const stubBaseUrl = String(integration.config['stubBaseUrl'] ?? '').replace(/\/$/, '');
    const coreBaseUrl = String(integration.config['coreBaseUrl'] ?? config.stubUpstream.coreBaseUrl).replace(/\/$/, '');
    if (!stubBaseUrl) {
      throw new ValidationError('Stub integration is missing stubBaseUrl');
    }

    const res = await fetch(`${stubBaseUrl}/v1/alerts/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: String(input.tenantId),
        coreBaseUrl,
        webhookSecret: config.webhook.secret,
        title: input.title ?? 'Stub upstream alert',
        description: input.description ?? 'Alert emitted by stub upstream for OSS connector verification',
        priority: input.priority ?? 'P2',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      throw new ValidationError(
        typeof body['error'] === 'string' ? body['error'] : `Stub ingest failed with HTTP ${res.status}`,
      );
    }

    const stubState = (body['state'] as Record<string, unknown>) ?? {};
    const incidentId = typeof body['incidentId'] === 'string' ? body['incidentId'] : undefined;

    return {
      emitted: body['emitted'] === true,
      incidentId,
      stubState,
      ingestedAt: new Date().toISOString(),
    };
  }
}
