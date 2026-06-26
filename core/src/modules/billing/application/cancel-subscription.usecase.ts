import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { getStripeClient } from '../infra/stripe-client.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

/**
 * Schedules subscription cancellation at the end of the current billing period.
 *
 * Does NOT cancel immediately — the customer retains access until period end.
 * Uses stripe.subscriptions.update({ cancel_at_period_end: true }).
 * The webhook (customer.subscription.updated) will update local state.
 */
export class CancelSubscriptionUseCase {
    constructor(private tenantRepo: ITenantRepository) {}

    async execute(tenantId: TenantId): Promise<{ cancelAtPeriodEnd: boolean; currentPeriodEnd?: string }> {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(tenantId);
        }
        if (!tenant.stripeSubscriptionId) {
            throw new ValidationError('No active subscription to cancel');
        }
        if (tenant.cancelAtPeriodEnd) {
            throw new ValidationError('Subscription is already scheduled for cancellation');
        }

        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        // Optimistic update — webhook will confirm
        await this.tenantRepo.update(tenantId, {
            cancelAtPeriodEnd: true,
            updatedAt: new Date().toISOString(),
        });

        logger.info({ tenantId, subscriptionId: tenant.stripeSubscriptionId }, 'Subscription scheduled for cancellation');

        const cancelAt = subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : tenant.currentPeriodEnd;

        return {
            cancelAtPeriodEnd: true,
            currentPeriodEnd: cancelAt,
        };
    }
}
