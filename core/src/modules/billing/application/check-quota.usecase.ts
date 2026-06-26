import { PaymentRequiredError } from '../../../shared/domain/errors.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { QuotaCheckResult } from '../domain/billing.types.js';

export class CheckQuotaUseCase {
    constructor(
        private billingAccountRepo: IBillingAccountRepository,
    ) {}

    async execute(tenantId: TenantId, type: UsageType): Promise<QuotaCheckResult> {
        const account = await this.billingAccountRepo.findByTenantId(tenantId);
        if (!account) {
            throw new PaymentRequiredError('No billing account found — subscribe to a plan first');
        }

        const used = type === 'investigation' ? account.investigationsUsed : account.eventsUsed;
        const limit = type === 'investigation' ? account.investigationsLimit : account.eventsLimit;
        const unlimited = limit === -1;
        const remaining = unlimited ? Infinity : limit - used;
        return {
            allowed: unlimited || used < limit,
            type,
            used,
            limit,
            remaining: unlimited ? -1 : remaining,
        };
    }

    async executeOrThrow(tenantId: TenantId, type: UsageType): Promise<QuotaCheckResult> {
        const result = await this.execute(tenantId, type);
        if (!result.allowed) {
            const label = type === 'investigation' ? 'INVESTIGATIONS' : 'EVENTS';
            throw new PaymentRequiredError(`${label}_EXHAUSTED`, 'upgrade', { type, used: result.used, limit: result.limit });
        }
        return result;
    }
}
