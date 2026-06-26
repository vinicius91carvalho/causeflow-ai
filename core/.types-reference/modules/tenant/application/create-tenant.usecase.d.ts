import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant, TenantSettings } from '../domain/tenant.entity.js';
import type { TenantPlan } from '../../../shared/domain/types.js';
import type { IEventBus } from '../../../shared/domain/events.js';
export interface CreateTenantInput {
    name: string;
    slug: string;
    ownerEmail: string;
    plan?: TenantPlan;
    settings?: Partial<TenantSettings>;
}
export declare class CreateTenantUseCase {
    private readonly repo;
    private readonly eventBus;
    constructor(repo: ITenantRepository, eventBus: IEventBus);
    execute(input: CreateTenantInput): Promise<Tenant>;
}
