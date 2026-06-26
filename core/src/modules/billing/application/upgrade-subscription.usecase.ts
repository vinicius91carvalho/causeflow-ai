import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { getStripeClient } from '../infra/stripe-client.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IPlanCatalogService } from '../domain/plan-catalog.port.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan } from '../../../shared/domain/types.js';

export interface UpgradeSubscriptionInput {
    tenantId: TenantId;
    targetPlanKey: TenantPlan;
}

export interface UpgradeSubscriptionResult {
    previousPlan: TenantPlan;
    newPlan: TenantPlan;
    effectiveImmediately: boolean;
}

/**
 * Upgrades (or downgrades) an existing Stripe subscription to a different plan.
 *
 * Uses stripe.subscriptions.update() to swap line items (flat fee + metered prices)
 * on the current subscription. Does NOT create a new subscription.
 *
 * Stripe prorates by default — the customer pays the difference immediately for upgrades,
 * or receives credit for downgrades.
 *
 * The webhook handler (customer.subscription.updated) will update the tenant
 * plan, quotas, and billing account when Stripe confirms the change.
 */
export class UpgradeSubscriptionUseCase {
    constructor(
        private tenantRepo: ITenantRepository,
        private planCatalog: IPlanCatalogService,
        private billingAccountRepo: IBillingAccountRepository,
    ) {}

    async execute(input: UpgradeSubscriptionInput): Promise<UpgradeSubscriptionResult> {
        const stripe = getStripeClient();

        const tenant = await this.tenantRepo.findById(input.tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(input.tenantId);
        }

        if (!tenant.stripeSubscriptionId) {
            throw new ValidationError('No active subscription found — use checkout to subscribe first');
        }
        if (tenant.plan === input.targetPlanKey) {
            throw new ValidationError(`Already on the ${input.targetPlanKey} plan`);
        }

        // Resolve target plan from catalog
        const targetPlan = await this.planCatalog.getPlanByKey(input.targetPlanKey);
        if (!targetPlan) {
            throw new ValidationError(`Plan "${input.targetPlanKey}" not found in catalog`);
        }
        if (!targetPlan.selfService) {
            throw new ValidationError(`Plan "${input.targetPlanKey}" is not available for self-service upgrade — contact sales`);
        }

        // Retrieve current subscription to get existing items
        const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
        const existingItems = subscription.items.data;

        // Build new items: replace all existing items with the target plan's prices
        // Stripe API requires 'price' on all items, use empty-string + deleted for removals
        const items: Array<{ id: string; deleted: true } | { price: string; quantity?: number }> = [];

        // Mark all existing items for deletion
        for (const item of existingItems) {
            items.push({ id: item.id, deleted: true });
        }

        // Add target plan's flat fee price
        if (targetPlan.stripePriceId) {
            items.push({ price: targetPlan.stripePriceId, quantity: 1 });
        }

        // Add target plan's metered prices
        if (targetPlan.metered) {
            items.push({ price: targetPlan.metered.invPriceId });
            items.push({ price: targetPlan.metered.evtPriceId });
        }

        // Update the subscription — Stripe prorates automatically
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        const updateParams = { items: items as any, proration_behavior: 'create_prorations' as const, metadata: { tenantId: input.tenantId } };
        await stripe.subscriptions.update(tenant.stripeSubscriptionId, updateParams);

        // Do NOT update local state here — the webhook (customer.subscription.updated)
        // will handle Tenant + BillingAccount sync after Stripe confirms the change.
        // This avoids inconsistency if the Stripe update succeeds but local write fails.
        const previousPlan = tenant.plan;

        logger.info({
            tenantId: input.tenantId,
            previousPlan,
            newPlan: input.targetPlanKey,
        }, 'Subscription upgraded');

        return {
            previousPlan,
            newPlan: input.targetPlanKey,
            effectiveImmediately: true,
        };
    }
}
