import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { Tenant } from '../../tenant/domain/tenant.entity.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { TenantPlan } from '../../../shared/domain/types.js';
export interface SignupInput {
    name: string;
    slug: string;
    ownerEmail: string;
    plan?: TenantPlan;
}
export interface SignupResult {
    tenant: Tenant;
    billingAccount: BillingAccount;
}
export declare class SignupUseCase {
    private readonly tenantRepo;
    private readonly billingAccountRepo;
    private readonly eventBus;
    constructor(tenantRepo: ITenantRepository, billingAccountRepo: IBillingAccountRepository, eventBus: IEventBus);
    execute(input: SignupInput): Promise<SignupResult>;
}
