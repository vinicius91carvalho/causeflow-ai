import { TriggerEventMapper } from '../infra/trigger-event-mapper.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { ComposioWebhookValidator } from '../infra/composio-webhook-validator.js';
import type { IngestAlertUseCase } from '../../ingestion/application/ingest-alert.usecase.js';

export interface ComposioWebhookPayload {
    id: string;
    type: string;
    metadata: {
        trigger_slug: string;
        trigger_id: string;
        connected_account_id: string;
    };
    data: Record<string, unknown>;
}

export interface HandleComposioWebhookInput {
    rawBody: string;
    signatureHeader: string;
}

export class HandleComposioWebhookUseCase {
    validator;
    triggerRepo;
    ingestAlert;
    eventBus;
    mapper = new TriggerEventMapper();
    constructor(validator: ComposioWebhookValidator, triggerRepo: ITriggerRepository, ingestAlert: IngestAlertUseCase, eventBus: IEventBus) {
        this.validator = validator;
        this.triggerRepo = triggerRepo;
        this.ingestAlert = ingestAlert;
        this.eventBus = eventBus;
    }
    async execute(input: HandleComposioWebhookInput) {
        // 1. Validate HMAC signature
        if (!this.validator.validate(input.rawBody, input.signatureHeader)) {
            return { processed: false, action: 'invalid_signature' };
        }
        // 2. Parse payload
        const payload = JSON.parse(input.rawBody) as ComposioWebhookPayload;
        // Only handle trigger messages
        if (payload.type !== 'composio.trigger.message') {
            return { processed: false, action: 'ignored_event_type' };
        }
        const { trigger_slug, trigger_id } = payload.metadata;
        // 3. Resolve tenant from composioTriggerId
        const trigger = await this.triggerRepo.findByComposioTriggerId(trigger_id);
        if (!trigger) {
            console.warn(`[ComposioWebhook] No trigger found for composioTriggerId: ${trigger_id}`);
            return { processed: false, action: 'trigger_not_found' };
        }
        // 4. Map the trigger event to a CauseFlow action
        const mapping = this.mapper.map(trigger_slug, payload.data, trigger.tenantId);
        let actionTaken = 'unknown';
        switch (mapping.type) {
            case 'alert': {
                // Feed into existing ingestion pipeline
                const rawAlert = {
                    source: mapping.source,
                    externalId: payload.id,
                    payload: mapping.payload,
                };
                await this.ingestAlert.execute(trigger.tenantId, rawAlert);
                actionTaken = 'incident_created';
                break;
            }
            case 'change_event': {
                // Publish as graph change event (don't call AddChangeEventUseCase directly
                // because it requires a valid serviceId — let the graph module's
                // change correlator handle service resolution)
                await this.eventBus.publish({
                    eventType: 'graph.change_added',
                    occurredAt: new Date().toISOString(),
                    tenantId: String(trigger.tenantId),
                    payload: {
                        changeId: payload.id,
                        serviceId: mapping.data.metadata['repoName'] ?? 'unknown',
                        changeType: mapping.data.changeType,
                        description: mapping.data.description,
                        source: mapping.data.source,
                        metadata: mapping.data.metadata,
                    },
                });
                actionTaken = 'change_event_published';
                break;
            }
            default:
                actionTaken = 'unknown_trigger';
        }
        // 5. Update trigger stats
        await this.triggerRepo.update(trigger.tenantId, trigger.triggerId, {
            lastEventAt: new Date().toISOString(),
            eventCount: trigger.eventCount + 1,
        });
        // 6. Publish trigger event received
        await this.eventBus.publish({
            eventType: 'trigger.event_received',
            occurredAt: new Date().toISOString(),
            tenantId: String(trigger.tenantId),
            payload: {
                triggerId: String(trigger.triggerId),
                triggerSlug: trigger_slug,
                provider: trigger.provider,
                composioTriggerId: trigger_id,
                actionTaken,
                data: payload.data,
            },
        });
        return { processed: true, action: actionTaken };
    }
}
