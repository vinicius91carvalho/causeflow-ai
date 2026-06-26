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
}
export declare class UpdateTenantUseCase {
    private readonly repo;
    private readonly eventBus;
    constructor(repo: ITenantRepository, eventBus: IEventBus);
    execute(id: TenantId, input: UpdateTenantInput): Promise<Tenant>;
}
