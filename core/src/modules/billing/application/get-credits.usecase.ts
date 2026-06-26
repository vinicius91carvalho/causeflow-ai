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

export class GetCreditsUseCase {
    billingRepo;
    constructor(billingRepo: IBillingAccountRepository) {
        this.billingRepo = billingRepo;
    }
    async execute(tenantId: TenantId): Promise<CreditsResult> {
        const account = await this.billingRepo.findByTenantId(tenantId);
        if (!account) {
            return {
                investigations: { total: 0, used: 0, remaining: 0 },
                events: { total: 0, used: 0, remaining: 0 },
            };
        }
        return {
            investigations: {
                total: account.investigationsLimit,
                used: account.investigationsUsed,
                remaining: Math.max(0, account.investigationsLimit - account.investigationsUsed),
            },
            events: {
                total: account.eventsLimit,
                used: account.eventsUsed,
                remaining: Math.max(0, account.eventsLimit - account.eventsUsed),
            },
        };
    }
}
