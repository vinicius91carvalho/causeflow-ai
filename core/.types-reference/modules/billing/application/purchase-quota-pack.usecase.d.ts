import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { UsageType } from '../../../shared/domain/types.js';
export interface PurchaseQuotaPackInput {
    tenantId: TenantId;
    type: UsageType;
}
export interface PurchaseQuotaPackResult {
    type: UsageType;
    amountAdded: number;
    priceUsd: number;
    newLimit: number;
}
export declare class PurchaseQuotaPackUseCase {
    private readonly billingAccountRepo;
    constructor(billingAccountRepo: IBillingAccountRepository);
    execute(input: PurchaseQuotaPackInput): Promise<PurchaseQuotaPackResult>;
}
