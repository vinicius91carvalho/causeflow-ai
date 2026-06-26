import type { TenantId, TriggerId } from '../../../shared/domain/value-objects.js';
import type { Trigger } from '../domain/trigger.entity.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
export declare class DynamoTriggerRepository implements ITriggerRepository {
    create(trigger: Trigger): Promise<Trigger>;
    findById(tid: TenantId, trgId: TriggerId): Promise<Trigger | null>;
    findByComposioTriggerId(composioTriggerId: string): Promise<Trigger | null>;
    listByTenant(tid: TenantId): Promise<Trigger[]>;
    update(tid: TenantId, trgId: TriggerId, data: Partial<Trigger>): Promise<void>;
    delete(tid: TenantId, trgId: TriggerId): Promise<void>;
}
