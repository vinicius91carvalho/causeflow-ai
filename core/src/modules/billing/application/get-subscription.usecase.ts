import { PLAN_QUOTAS, type SubscriptionInfo } from '../domain/billing.types.js';
import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IPlanCatalogService } from '../domain/plan-catalog.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export class GetSubscriptionUseCase {
    constructor(
        private tenantRepo: ITenantRepository,
        private billingAccountRepo?: IBillingAccountRepository,
        private planCatalog?: IPlanCatalogService,
    ) {}

    async execute(tenantId: TenantId): Promise<SubscriptionInfo> {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(tenantId);
        }
        const account = await this.billingAccountRepo?.findByTenantId(tenantId);

        // Resolve plan quotas from catalog, fallback to hardcoded
        let investigationsLimit = PLAN_QUOTAS[tenant.plan]?.investigations ?? 15;
        let eventsLimit = PLAN_QUOTAS[tenant.plan]?.events ?? 500;
        if (this.planCatalog) {
            try {
                const planDef = await this.planCatalog.getPlanByKey(tenant.plan);
                if (planDef) {
                    investigationsLimit = planDef.investigationsLimit;
                    eventsLimit = planDef.eventsLimit;
                }
            } catch (err) {
                logger.warn({ err, tenantId, plan: tenant.plan }, 'Plan catalog unavailable — using fallback');
            }
        }

        return {
            plan: tenant.plan,
            status: tenant.subscriptionStatus ?? 'active',
            investigationsLimit: account?.investigationsLimit ?? investigationsLimit,
            investigationsUsed: account?.investigationsUsed ?? 0,
            eventsLimit: account?.eventsLimit ?? eventsLimit,
            eventsUsed: account?.eventsUsed ?? 0,
            renewDate: tenant.renewDate,
            currentPeriodEnd: tenant.currentPeriodEnd,
            cancelAtPeriodEnd: tenant.cancelAtPeriodEnd ?? false,
        };
    }
}
