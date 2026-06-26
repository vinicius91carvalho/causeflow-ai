import { TenantNotFoundError } from '../domain/tenant.errors.js';
import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant, TenantSettings } from '../domain/tenant.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan, TenantStatus } from '../../../shared/domain/types.js';
import type { IEventBus } from '../../../shared/domain/events.js';

export interface UpdateTenantInput {
    name?: string;
    plan?: TenantPlan;
    status?: TenantStatus;
    settings?: Partial<TenantSettings>;
    actorUserId?: string;
    actorEmail?: string;
}

export class UpdateTenantUseCase {
    repo;
    eventBus;
    constructor(repo: ITenantRepository, eventBus: IEventBus) {
        this.repo = repo;
        this.eventBus = eventBus;
    }
    async execute(id: TenantId, input: UpdateTenantInput): Promise<Tenant> {
        const existing = await this.repo.findById(id);
        if (!existing) {
            throw new TenantNotFoundError(id);
        }
        const updateData = {
            ...(input.name && { name: input.name }),
            ...(input.plan && { plan: input.plan }),
            ...(input.status && { status: input.status }),
            ...(input.settings && {
                settings: { ...existing.settings, ...input.settings },
            }),
            updatedAt: new Date().toISOString(),
        };
        const updated = await this.repo.update(id, updateData);
        await this.eventBus.publish({
            eventType: 'tenant.updated',
            occurredAt: updated.updatedAt,
            tenantId: id,
            payload: { tenantId: id, changes: input, actorUserId: input.actorUserId, actorEmail: input.actorEmail },
        });
        return updated;
    }
}
