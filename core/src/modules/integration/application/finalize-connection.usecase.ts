import { integrationId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface FinalizeConnectionInput {
  tenantId: TenantId;
  provider: string;
  connectedAccountId: string;
  connectedBy: string;
}

export interface FinalizeConnectionOutput {
  connection: {
    id: string;
    provider: string;
    status: 'connected';
    connectedAccountId: string;
    connectedAt: string;
  };
}

export class FinalizeConnectionUseCase {
  constructor(private readonly eventBus?: IEventBus) {}

  async execute(input: FinalizeConnectionInput): Promise<FinalizeConnectionOutput> {
    const { tenantId, provider, connectedAccountId, connectedBy } = input;
    if (!connectedAccountId || typeof connectedAccountId !== 'string') {
      throw new ValidationError('connectedAccountId is required', { code: 'missing_connected_account_id' });
    }

    const intId = integrationId(`${provider}-composio`);
    const now = new Date().toISOString();

    await IntegrationEntity.upsert({
      tenantId,
      integrationId: intId,
      provider,
      category: 'cloud',
      status: 'active',
      displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
      config: {
        apiKeyRef: connectedAccountId, // store connectedAccountId in apiKeyRef
      },
      connectedBy,
      createdAt: now,
    }).go();

    await this.eventBus?.publish({
      eventType: 'integration.connected',
      occurredAt: now,
      tenantId,
      payload: { integrationId: intId, provider, connectedBy },
    });

    return {
      connection: {
        id: intId,
        provider,
        status: 'connected',
        connectedAccountId,
        connectedAt: now,
      },
    };
  }
}
