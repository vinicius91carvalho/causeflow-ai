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
export declare class HandleComposioWebhookUseCase {
    private readonly validator;
    private readonly triggerRepo;
    private readonly ingestAlert;
    private readonly eventBus;
    private readonly mapper;
    constructor(validator: ComposioWebhookValidator, triggerRepo: ITriggerRepository, ingestAlert: IngestAlertUseCase, eventBus: IEventBus);
    execute(input: HandleComposioWebhookInput): Promise<{
        processed: boolean;
        action?: string;
    }>;
}
