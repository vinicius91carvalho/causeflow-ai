import { config } from '../../../shared/config/index.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import { logger } from '../../../shared/infra/logger.js';
import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IPlanCatalogService } from '../domain/plan-catalog.port.js';
import { getStripeClient } from '../infra/stripe-client.js';

export interface CreateSubscriptionInput {
  tenantId: TenantId;
  planId: string; // Stripe flat-fee price ID
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  clientSecret: string;
  status: string;
}

/**
 * Creates a Stripe subscription with payment_behavior='default_incomplete'.
 *
 * Returns the clientSecret from the PaymentIntent (or SetupIntent for trials)
 * so the frontend can confirm payment inline using Stripe Payment Element.
 *
 * Flow:
 * 1. Resolve plan from catalog (for metered prices + trial days)
 * 2. Create subscription with all line items (flat + metered)
 * 3. Return clientSecret for frontend to confirm
 * 4. Webhook handles activation after payment succeeds
 */
export class CreateSubscriptionUseCase {
  constructor(
    private tenantRepo: ITenantRepository,
    private planCatalog: IPlanCatalogService,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const stripe = getStripeClient();

    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) {
      throw new TenantNotFoundError(input.tenantId);
    }

    if (!tenant.stripeCustomerId) {
      throw new ValidationError(
        'Stripe customer not found — should have been created at organization creation',
      );
    }

    if (tenant.stripeSubscriptionId) {
      throw new ValidationError('Tenant already has an active subscription — use upgrade instead');
    }

    // Resolve human-readable plan keys ('starter', 'pro', 'business') to Stripe price IDs.
    // Raw Stripe price IDs (e.g. 'price_abc123') pass through unchanged.
    const planKeyMap: Record<string, string | undefined> = {
      starter: config.stripe.starterPriceId || undefined,
      pro: config.stripe.proPriceId || undefined,
      business: config.stripe.businessPriceId || undefined,
    };
    const resolvedPlanId = planKeyMap[input.planId] ?? input.planId;

    // Resolve plan from catalog
    const planDef = await this.planCatalog.getPlanByPriceId(resolvedPlanId);

    // Build line items: flat fee + metered prices
    const items: Array<{ price: string; quantity?: number }> = [
      { price: resolvedPlanId, quantity: 1 },
    ];
    if (planDef?.metered) {
      items.push({ price: planDef.metered.invPriceId });
      items.push({ price: planDef.metered.evtPriceId });
    }

    const trialDays = planDef?.trialDays ?? 0;

    // Create subscription — payment is NOT collected yet
    const subscription = await stripe.subscriptions.create({
      customer: tenant.stripeCustomerId,
      items,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      metadata: { tenantId: input.tenantId },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      ...(trialDays > 0 && { trial_period_days: trialDays }),
    });

    // Extract clientSecret — from PaymentIntent (immediate charge) or SetupIntent (trial)
    let clientSecret: string;

    if (trialDays > 0) {
      // Trial: Stripe creates a SetupIntent to save card for later
      const setupIntent = subscription.pending_setup_intent;
      if (typeof setupIntent === 'object' && setupIntent?.client_secret) {
        clientSecret = setupIntent.client_secret;
      } else {
        throw new ValidationError('Failed to create setup intent for trial subscription');
      }
    } else {
      // No trial: Stripe creates a PaymentIntent on the first invoice
      const latestInvoice = subscription.latest_invoice;
      const invoice = typeof latestInvoice === 'object' ? latestInvoice : null;
      // In Stripe API 2026-02-25.clover, payment_intent may be on the invoice directly
      const rawPi = (invoice as Record<string, unknown> | null)?.['payment_intent'];
      const pi = typeof rawPi === 'object' && rawPi ? (rawPi as { client_secret?: string }) : null;

      if (!pi?.client_secret) {
        throw new ValidationError('Failed to create payment intent for subscription');
      }
      clientSecret = pi.client_secret;
    }

    logger.info(
      {
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        trial: trialDays > 0,
      },
      'Subscription created (pending payment confirmation)',
    );

    return {
      subscriptionId: subscription.id,
      clientSecret,
      status: subscription.status,
    };
  }
}
