import { integrationId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { config } from '../../../shared/config/index.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IIntegrationRepository } from '../domain/integration.repository.js';
import type { IntegrationRecord } from '../domain/integration.entity.js';

export interface ConnectStubIntegrationInput {
  tenantId: TenantId;
  connectedBy: string;
  baseUrl?: string;
  coreBaseUrl?: string;
}

export interface ConnectStubIntegrationOutput {
  integrationId: string;
  provider: string;
  status: string;
  stubConnectionId: string;
  stubBaseUrl: string;
  connectedAt: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof body['error'] === 'string' ? body['error'] : `HTTP ${res.status}`;
    throw new ValidationError(`Stub upstream request failed: ${message}`);
  }
  return body;
}

export class ConnectStubIntegrationUseCase {
  constructor(
    private readonly integrationRepo: IIntegrationRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  async execute(input: ConnectStubIntegrationInput): Promise<ConnectStubIntegrationOutput> {
    const stubBaseUrl = (input.baseUrl ?? config.stubUpstream.baseUrl).replace(/\/$/, '');
    const coreBaseUrl = (input.coreBaseUrl ?? config.stubUpstream.coreBaseUrl).replace(/\/$/, '');

    await fetchJson(`${stubBaseUrl}/health`);

    const connectBody = await fetchJson(`${stubBaseUrl}/v1/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: String(input.tenantId),
        coreBaseUrl,
        webhookSecret: config.webhook.secret,
      }),
    });

    const stubConnectionId = String(connectBody['connectionId'] ?? '');
    if (!stubConnectionId) {
      throw new ValidationError('Stub upstream did not return connectionId');
    }

    const now = new Date().toISOString();
    const intId = integrationId('stub-upstream-credential');
    const record: IntegrationRecord = {
      tenantId: input.tenantId,
      integrationId: intId,
      provider: 'stub-upstream',
      category: 'monitoring',
      status: 'active',
      displayName: 'Stub Upstream (OSS)',
      config: {
        stubBaseUrl,
        coreBaseUrl,
        stubConnectionId,
      },
      connectedBy: input.connectedBy,
      createdAt: now,
      updatedAt: now,
    };
    await this.integrationRepo.upsert(record);

    await this.eventBus?.publish({
      eventType: 'integration.connected',
      occurredAt: now,
      tenantId: input.tenantId,
      payload: { integrationId: intId, provider: 'stub-upstream', connectedBy: input.connectedBy },
    });

    return {
      integrationId: intId,
      provider: 'stub-upstream',
      status: 'active',
      stubConnectionId,
      stubBaseUrl,
      connectedAt: now,
    };
  }
}
