import { v4 as uuidv4 } from 'uuid';
import { triggerId } from '../../../shared/domain/value-objects.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { Trigger } from '../domain/trigger.entity.js';
import type { ITriggerProviderService } from '../../../shared/application/ports/trigger-provider.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import { TriggerAlreadyExistsError } from '../domain/trigger.errors.js';

export interface CreateTriggerInput {
    tenantId: TenantId;
    triggerSlug: string;
    provider: string;
    config: Record<string, unknown>;
    connectedAccountId: string;
}

export class CreateTriggerUseCase {
    triggerRepo;
    composioTriggerService;
    eventBus;
    constructor(triggerRepo: ITriggerRepository, composioTriggerService: ITriggerProviderService, eventBus: IEventBus) {
        this.triggerRepo = triggerRepo;
        this.composioTriggerService = composioTriggerService;
        this.eventBus = eventBus;
    }
    async execute(input: CreateTriggerInput): Promise<Trigger> {
        // Check for duplicate before calling Composio
        const existing = await this.triggerRepo.findByTenantProviderSlug(
            String(input.tenantId),
            input.provider,
            input.triggerSlug,
        );
        if (existing) {
            throw new TriggerAlreadyExistsError(input.triggerSlug, String(input.tenantId));
        }
        const result = await this.composioTriggerService.createTrigger(input.connectedAccountId, input.triggerSlug, input.config, input.provider);
        const now = new Date().toISOString();
        const trigger = {
            triggerId: triggerId(uuidv4()),
            tenantId: input.tenantId,
            triggerSlug: input.triggerSlug,
            provider: input.provider,
            composioTriggerId: result.composioTriggerId,
            connectedAccountId: result.connectedAccountId,
            config: input.config,
            status: 'active',
            eventCount: 0,
            createdAt: now,
            updatedAt: now,
        };
        const saved = await this.triggerRepo.create(trigger as Trigger);
        await this.eventBus.publish({
            eventType: 'trigger.created',
            occurredAt: now,
            tenantId: String(input.tenantId),
            payload: {
                triggerId: String(saved.triggerId),
                triggerSlug: saved.triggerSlug,
                provider: saved.provider,
            },
        });
        return saved;
    }
}
