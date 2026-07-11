import { integrationId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IIntegrationRepository } from '../domain/integration.repository.js';
import type { IntegrationRecord } from '../domain/integration.entity.js';

/** Additional OSS connectors that can be enabled against the connected test app. */
export const STUB_ENABLEABLE_PROVIDERS = ['datadog', 'webhooks'] as const;
export type StubEnableableProvider = (typeof STUB_ENABLEABLE_PROVIDERS)[number];

export interface EnableStubConnectorInput {
  tenantId: TenantId;
  connectedBy: string;
  provider: string;
}

export interface EnableStubConnectorOutput {
  integrationId: string;
  provider: string;
  status: string;
  stubBaseUrl: string;
  linkedTo: string;
  connectedAt: string;
}

const DISPLAY_NAMES: Record<StubEnableableProvider, string> = {
  datadog: 'Datadog (OSS stub)',
  webhooks: 'Webhooks (OSS stub)',
};

/**
 * Enable a second catalog connector against the already-connected Core test app
 * (web AC-058 Step 2). Persists a separate IntegrationRecord without Composio
 * or KMS credential encryption — config points at the stub-upstream connection.
 */
export class EnableStubConnectorUseCase {
  constructor(
    private readonly integrationRepo: IIntegrationRepository,
    private readonly eventBus?: IEventBus,
  ) {}

  async execute(input: EnableStubConnectorInput): Promise<EnableStubConnectorOutput> {
    const provider = String(input.provider ?? '').toLowerCase().trim();
    if (!STUB_ENABLEABLE_PROVIDERS.includes(provider as StubEnableableProvider)) {
      throw new ValidationError(
        `Unsupported stub connector "${provider}". Allowed: ${STUB_ENABLEABLE_PROVIDERS.join(', ')}`,
      );
    }

    const stub = await this.integrationRepo.findByProvider(input.tenantId, 'stub-upstream');
    if (!stub || stub.status !== 'active') {
      throw new ValidationError(
        'Connect the Test Application (stub-upstream) before enabling additional connectors',
      );
    }

    const stubBaseUrl = String(stub.config['stubBaseUrl'] ?? '').replace(/\/$/, '');
    const stubConnectionId = String(stub.config['stubConnectionId'] ?? '');
    if (!stubBaseUrl) {
      throw new ValidationError('Stub upstream connection is missing stubBaseUrl');
    }

    const now = new Date().toISOString();
    const intId = integrationId(`${provider}-stub-credential`);
    const record: IntegrationRecord = {
      tenantId: input.tenantId,
      integrationId: intId,
      provider,
      category: 'monitoring',
      status: 'active',
      displayName: DISPLAY_NAMES[provider as StubEnableableProvider],
      config: {
        stubBaseUrl,
        stubConnectionId,
        linkedTo: 'stub-upstream',
        via: 'oss-stub-enable',
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
      payload: {
        integrationId: intId,
        provider,
        connectedBy: input.connectedBy,
        linkedTo: 'stub-upstream',
      },
    });

    return {
      integrationId: intId,
      provider,
      status: 'active',
      stubBaseUrl,
      linkedTo: 'stub-upstream',
      connectedAt: now,
    };
  }
}
