import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { Trigger } from '../domain/trigger.entity.js';
export class ListTriggersUseCase {
    triggerRepo;
    constructor(triggerRepo: ITriggerRepository) {
        this.triggerRepo = triggerRepo;
    }
    async execute(tenantId: TenantId): Promise<Trigger[]> {
        return this.triggerRepo.listByTenant(tenantId);
    }
}
