import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { SubscriptionInfo } from '../domain/billing.types.js';
export declare class GetSubscriptionUseCase {
    private readonly tenantRepo;
    private readonly billingAccountRepo?;
    constructor(tenantRepo: ITenantRepository, billingAccountRepo?: IBillingAccountRepository | undefined);
    execute(tenantId: TenantId): Promise<SubscriptionInfo>;
}
