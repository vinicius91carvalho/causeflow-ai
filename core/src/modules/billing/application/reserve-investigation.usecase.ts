import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IMeterEventService } from './ports/meter-event.port.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';

export interface ReserveInvestigationResult {
    reserved: boolean;
    reason?: string;
}

export class ReserveInvestigationUseCase {
    constructor(
        private billingAccountRepo: IBillingAccountRepository,
        private meterEventService?: IMeterEventService,
        private tenantRepo?: ITenantRepository,
    ) {}

    async execute(tenantId: TenantId): Promise<ReserveInvestigationResult> {
        const result = await this.billingAccountRepo.reserveInvestigation(tenantId);

        if (!result.reserved) {
            return { reserved: false, reason: result.reason ?? 'quota_exceeded' };
        }

        // Report to Stripe Meter (fire-and-forget)
        if (this.meterEventService && this.tenantRepo) {
            const tenant = await this.tenantRepo.findById(tenantId);
            if (tenant?.stripeCustomerId) {
                this.meterEventService.reportUsage({
                    eventName: 'causeflow_investigation',
                    stripeCustomerId: tenant.stripeCustomerId,
                }).catch(() => {}); // Already logged in service
            }
        }

        return { reserved: true };
    }
}
