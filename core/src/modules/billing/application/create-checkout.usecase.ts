import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { getStripeClient } from '../infra/stripe-client.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IPlanCatalogService } from '../domain/plan-catalog.port.js';
import type { CheckoutInput } from '../domain/billing.types.js';

export class CreateCheckoutUseCase {
    constructor(
        private tenantRepo: ITenantRepository,
        private planCatalog: IPlanCatalogService,
    ) {}

    async execute(input: CheckoutInput) {
        const stripe = getStripeClient();
        const tenant = await this.tenantRepo.findById(input.tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(input.tenantId);
        }

        // Block if tenant already has an active subscription
        if (tenant.stripeSubscriptionId) {
            throw new ValidationError('Tenant already has an active subscription. Use /v1/billing/upgrade to change plans.');
        }

        // Create Stripe customer on first checkout if not yet created
        let customerId = tenant.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                name: tenant.name,
                email: tenant.ownerEmail || undefined,
                metadata: { tenantId: String(input.tenantId) },
            });
            customerId = customer.id;
            await this.tenantRepo.update(input.tenantId, {
                stripeCustomerId: customerId,
                updatedAt: new Date().toISOString(),
            });
            logger.info({ tenantId: input.tenantId, customerId }, 'Stripe customer created at checkout');
        }

        // Resolve planKey → Stripe prices via catalog
        const planDef = await this.planCatalog.getPlanByKey(input.planKey);
        if (!planDef) {
            throw new ValidationError(`Unknown plan: ${input.planKey}`);
        }

        // Build line items: flat fee + metered prices (investigation & event)
        const lineItems: Array<{ price: string; quantity?: number }> = [
            { price: planDef.stripePriceId, quantity: 1 },
        ];
        if (planDef?.metered) {
            lineItems.push({ price: planDef.metered.invPriceId });
            lineItems.push({ price: planDef.metered.evtPriceId });
        }

        const trialDays = planDef?.trialDays ?? 0;

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: lineItems,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            subscription_data: {
                metadata: { tenantId: input.tenantId },
                ...(trialDays > 0 && { trial_period_days: trialDays }),
            },
        });
        return { url: session.url };
    }
}
