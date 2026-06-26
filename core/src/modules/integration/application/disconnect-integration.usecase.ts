import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import { integrationId } from '../../../shared/domain/value-objects.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface DisconnectIntegrationInput {
    tenantId: TenantId;
    provider: string;
    disconnectedBy?: string;
}

export class DisconnectIntegrationUseCase {
    eventBus;
    constructor(eventBus?: IEventBus) {
        this.eventBus = eventBus;
    }
    async execute(input: DisconnectIntegrationInput) {
        const { tenantId, provider } = input;
        const intId = integrationId(`${provider}-credential`);
        const existing = await IntegrationEntity.get({ tenantId, integrationId: intId }).go();
        if (!existing.data) {
            throw new NotFoundError('Integration', `${provider} for tenant ${tenantId}`);
        }
        await IntegrationEntity.patch({ tenantId, integrationId: intId })
            .set({ status: 'inactive' })
            .go();
        await this.eventBus?.publish({
            eventType: 'integration.disconnected',
            occurredAt: new Date().toISOString(),
            tenantId: tenantId,
            payload: { integrationId: intId, provider, disconnectedBy: input.disconnectedBy ?? 'unknown' },
        });
        return { success: true };
    }
}
