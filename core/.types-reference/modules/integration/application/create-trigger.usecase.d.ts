import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { Trigger } from '../domain/trigger.entity.js';
import type { ComposioTriggerService } from '../../../shared/infra/integrations/composio-trigger-service.js';
export interface CreateTriggerInput {
    tenantId: TenantId;
    triggerSlug: string;
    provider: string;
    config: Record<string, unknown>;
}
export declare class CreateTriggerUseCase {
    private readonly triggerRepo;
    private readonly composioTriggerService;
    private readonly eventBus;
    constructor(triggerRepo: ITriggerRepository, composioTriggerService: ComposioTriggerService, eventBus: IEventBus);
    execute(input: CreateTriggerInput): Promise<Trigger>;
}
