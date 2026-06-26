import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface CreditsResult {
    investigations: {
        total: number;
        used: number;
        remaining: number;
    };
    events: {
        total: number;
        used: number;
        remaining: number;
    };
}
export declare class GetCreditsUseCase {
    private readonly billingRepo;
    constructor(billingRepo: IBillingAccountRepository);
    execute(tenantId: TenantId): Promise<CreditsResult>;
}
