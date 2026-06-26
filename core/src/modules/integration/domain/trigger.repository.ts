import type { TenantId, TriggerId } from '../../../shared/domain/value-objects.js';
import type { Trigger } from './trigger.entity.js';
export interface ITriggerRepository {
    create(trigger: Trigger): Promise<Trigger>;
    findById(tenantId: TenantId, triggerId: TriggerId): Promise<Trigger | null>;
    findByComposioTriggerId(composioTriggerId: string): Promise<Trigger | null>;
    findByTenantProviderSlug(tenantId: string, provider: string, triggerSlug: string): Promise<Trigger | null>;
    listByTenant(tenantId: TenantId): Promise<Trigger[]>;
    update(tenantId: TenantId, triggerId: TriggerId, data: Partial<Trigger>): Promise<void>;
    delete(tenantId: TenantId, triggerId: TriggerId): Promise<void>;
}
