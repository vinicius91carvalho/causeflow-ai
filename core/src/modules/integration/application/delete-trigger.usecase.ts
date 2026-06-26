import { AppError } from '../../../shared/domain/errors.js';
import type { TenantId, TriggerId } from '../../../shared/domain/value-objects.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { ComposioTriggerService } from '../../../shared/infra/integrations/composio-trigger-service.js';
export class DeleteTriggerUseCase {
    triggerRepo;
    composioTriggerService;
    eventBus;
    constructor(triggerRepo: ITriggerRepository, composioTriggerService: ComposioTriggerService, eventBus: IEventBus) {
        this.triggerRepo = triggerRepo;
        this.composioTriggerService = composioTriggerService;
        this.eventBus = eventBus;
    }
    async execute(tenantId: TenantId, triggerId: TriggerId): Promise<void> {
        const trigger = await this.triggerRepo.findById(tenantId, triggerId);
        if (!trigger) {
            throw new AppError('Trigger not found', 'TRIGGER_NOT_FOUND', 404);
        }
        // Remove from Composio first
        try {
            await this.composioTriggerService.deleteTrigger(trigger.composioTriggerId);
        }
        catch (err) {
            // Log but don't fail — trigger may already be removed from Composio
            console.warn('[DeleteTrigger] Failed to remove from Composio:', err instanceof Error ? err.message : err);
        }
        await this.triggerRepo.delete(tenantId, triggerId);
        await this.eventBus.publish({
            eventType: 'trigger.deleted',
            occurredAt: new Date().toISOString(),
            tenantId: String(tenantId),
            payload: {
                triggerId: String(triggerId),
                triggerSlug: trigger.triggerSlug,
                provider: trigger.provider,
            },
        });
    }
}
