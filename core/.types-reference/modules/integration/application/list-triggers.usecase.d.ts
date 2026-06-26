import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { Trigger } from '../domain/trigger.entity.js';
export declare class ListTriggersUseCase {
    private readonly triggerRepo;
    constructor(triggerRepo: ITriggerRepository);
    execute(tenantId: TenantId): Promise<Trigger[]>;
}
