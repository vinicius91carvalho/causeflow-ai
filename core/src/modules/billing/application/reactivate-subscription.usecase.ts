import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { getStripeClient } from '../infra/stripe-client.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

/**
 * Reactivates a subscription that was scheduled for cancellation.
 *
 * Removes the cancel_at_period_end flag so the subscription continues
 * renewing normally. Only works if the subscription hasn't actually ended yet.
 */
export class ReactivateSubscriptionUseCase {
    constructor(private tenantRepo: ITenantRepository) {}

    async execute(tenantId: TenantId): Promise<{ cancelAtPeriodEnd: boolean }> {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(tenantId);
        }
        if (!tenant.stripeSubscriptionId) {
            throw new ValidationError('No subscription to reactivate');
        }
        if (!tenant.cancelAtPeriodEnd) {
            throw new ValidationError('Subscription is not scheduled for cancellation');
        }

        const stripe = getStripeClient();
        await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
            cancel_at_period_end: false,
        });

        // Optimistic update — webhook will confirm
        await this.tenantRepo.update(tenantId, {
            cancelAtPeriodEnd: false,
            subscriptionStatus: 'active',
            updatedAt: new Date().toISOString(),
        });

        logger.info({ tenantId, subscriptionId: tenant.stripeSubscriptionId }, 'Subscription reactivated');

        return { cancelAtPeriodEnd: false };
    }
}
