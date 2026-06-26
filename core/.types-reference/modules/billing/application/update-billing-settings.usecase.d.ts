import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { OveragePolicy } from '../../../shared/domain/types.js';
export interface UpdateBillingSettingsInput {
    tenantId: TenantId;
    overagePolicy?: OveragePolicy;
}
export declare class UpdateBillingSettingsUseCase {
    private readonly billingAccountRepo;
    constructor(billingAccountRepo: IBillingAccountRepository);
    execute(input: UpdateBillingSettingsInput): Promise<BillingAccount>;
}
