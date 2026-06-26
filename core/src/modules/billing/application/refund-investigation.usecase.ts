import { logger } from '../../../shared/infra/logger.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';

export class RefundInvestigationUseCase {
    constructor(
        private billingAccountRepo: IBillingAccountRepository,
    ) {}

    async execute(tenantId: TenantId): Promise<void> {
        try {
            await this.billingAccountRepo.refundInvestigation(tenantId);
        } catch (err) {
            // Log but don't throw — refund failure should not block error handling
            logger.error({ err, tenantId }, 'Failed to refund investigation credit');
        }
    }
}
