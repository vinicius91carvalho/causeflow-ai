import { NotFoundError } from '../../../shared/domain/errors.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';

export interface UpdateBillingSettingsInput {
    tenantId: TenantId;
}

export class UpdateBillingSettingsUseCase {
    constructor(private billingAccountRepo: IBillingAccountRepository) {}

    async execute(input: UpdateBillingSettingsInput): Promise<BillingAccount> {
        const account = await this.billingAccountRepo.findByTenantId(input.tenantId);
        if (!account) {
            throw new NotFoundError('BillingAccount', input.tenantId);
        }
        return account;
    }
}
