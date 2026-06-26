import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_TENANT_SETTINGS } from '../../tenant/domain/tenant.entity.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import { PLAN_QUOTAS } from '../domain/billing.types.js';
import { TenantSlugConflictError } from '../../tenant/domain/tenant.errors.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { Tenant } from '../../tenant/domain/tenant.entity.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { TenantPlan } from '../../../shared/domain/types.js';
import type { IPlanCatalogService } from '../domain/plan-catalog.port.js';

export interface SignupInput {
    name: string;
    slug: string;
    ownerEmail: string;
    plan?: TenantPlan;
}

export interface SignupResult {
    tenant: Tenant;
    billingAccount: BillingAccount;
}

export class SignupUseCase {
    constructor(
        private tenantRepo: ITenantRepository,
        private billingAccountRepo: IBillingAccountRepository,
        private eventBus: IEventBus,
        private planCatalog?: IPlanCatalogService,
    ) {}

    async execute(input: SignupInput): Promise<SignupResult> {
        const existing = await this.tenantRepo.findBySlug(input.slug);
        if (existing) {
            throw new TenantSlugConflictError(input.slug);
        }
        const plan = input.plan ?? 'starter';

        // Resolve quotas from catalog, fallback to hardcoded
        let investigationsLimit = PLAN_QUOTAS[plan]?.investigations ?? 15;
        let eventsLimit = PLAN_QUOTAS[plan]?.events ?? 500;
        if (this.planCatalog) {
            try {
                const planDef = await this.planCatalog.getPlanByKey(plan);
                if (planDef) {
                    investigationsLimit = planDef.investigationsLimit;
                    eventsLimit = planDef.eventsLimit;
                }
            } catch (err) {
                logger.warn({ err, plan }, 'Plan catalog unavailable during signup — using fallback');
            }
        }

        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const tid = tenantId(uuidv4());
        const tenant: Tenant = {
            tenantId: tid,
            name: input.name,
            slug: input.slug,
            ownerEmail: input.ownerEmail,
            plan,
            status: 'active',
            settings: { ...DEFAULT_TENANT_SETTINGS },
            renewDate: periodEnd.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };
        const createdTenant = await this.tenantRepo.create(tenant);
        const billingAccount: BillingAccount = {
            tenantId: tid,
            investigationsLimit,
            investigationsUsed: 0,
            eventsLimit,
            eventsUsed: 0,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };
        const createdAccount = await this.billingAccountRepo.create(billingAccount);
        await this.eventBus.publish({
            eventType: 'tenant.created',
            occurredAt: now.toISOString(),
            tenantId: tid,
            payload: { tenantId: tid, slug: input.slug, plan, source: 'self_service' },
        });
        return { tenant: createdTenant, billingAccount: createdAccount };
    }
}
