import type { TenantId, TriggerId } from '../../../shared/domain/value-objects.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { ComposioTriggerService } from '../../../shared/infra/integrations/composio-trigger-service.js';
export declare class DeleteTriggerUseCase {
    private readonly triggerRepo;
    private readonly composioTriggerService;
    private readonly eventBus;
    constructor(triggerRepo: ITriggerRepository, composioTriggerService: ComposioTriggerService, eventBus: IEventBus);
    execute(tenantId: TenantId, triggerId: TriggerId): Promise<void>;
}
