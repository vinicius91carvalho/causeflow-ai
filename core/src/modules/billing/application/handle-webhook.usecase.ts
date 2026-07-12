import { tenantId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { getStripeClient } from '../infra/stripe-client.js';
import { config } from '../../../shared/config/index.js';
import { logger } from '../../../shared/infra/logger.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IPlanCatalogService } from '../domain/plan-catalog.port.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { TenantPlan } from '../../../shared/domain/types.js';

interface StripeInvoice {
  id: string;
  parent?: { type: string; subscription_details?: { subscription?: string | { id: string } } };
  period_end: number;
  billing_reason?: string;
}

interface StripeSubscription {
  id: string;
  cancel_at?: number;
  cancel_at_period_end: boolean;
  status: string;
  items: { data: Array<{ price?: { id: string } }> };
  metadata?: Record<string, string>;
}

interface StripeSession {
  id: string;
  subscription?: string | { id: string };
  customer?: string | { id: string };
  metadata?: Record<string, string>;
}

/**
 * Extract the subscription ID from an Invoice.
 * In Stripe API 2026-02-25.clover, the subscription is nested
 * under `parent.subscription_details.subscription`.
 */
function getSubscriptionIdFromInvoice(invoice: StripeInvoice): string | undefined {
  const parent = invoice.parent;
  if (!parent || parent.type !== 'subscription_details') return undefined;
  const sub = parent.subscription_details?.subscription;
  if (!sub) return undefined;
  return typeof sub === 'string' ? sub : sub.id;
}
/**
 * Compute the next period end from a Subscription.
 * In Stripe API 2026-02-25.clover, `current_period_end` was removed.
 * We use `cancel_at` (if set) or fall back to invoice `period_end`.
 */
function getPeriodEndFromSubscription(subscription: StripeSubscription): string | undefined {
  if (subscription.cancel_at) {
    return new Date(subscription.cancel_at * 1000).toISOString();
  }
  return undefined;
}

export class HandleWebhookUseCase {
  constructor(
    private tenantRepo: ITenantRepository,
    private planCatalog: IPlanCatalogService,
    private billingAccountRepo?: IBillingAccountRepository,
  ) {}

  /** Update tenant — rethrows ConditionalCheckFailed so Stripe retries until the tenant exists. */
  private async safeUpdate(tid: string, updates: Record<string, unknown>): Promise<void> {
    try {
      await this.tenantRepo.update(tenantId(tid), updates);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ConditionalCheckFailedException')) {
        logger.warn(
          { tenantId: tid },
          'Stripe webhook: tenant not found yet — will retry (Stripe retries for 72h)',
        );
      }
      throw err;
    }
  }

  async execute(rawBody: string, signature: string): Promise<void> {
    if (!config.stripe.webhookSecret) {
      throw new ValidationError('Stripe webhook secret not configured — refusing to process');
    }
    if (!signature) {
      throw new ValidationError('Missing stripe-signature header');
    }
    const stripe = getStripeClient();
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    } catch {
      throw new ValidationError('Invalid Stripe webhook signature');
    }
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as unknown as StripeSession);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as unknown as StripeInvoice);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as unknown as StripeSubscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as unknown as StripeSubscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as unknown as StripeInvoice);
        break;
      case 'customer.subscription.trial_will_end':
        this.handleTrialWillEnd(event.data.object as unknown as StripeSubscription);
        break;
      case 'product.updated':
      case 'price.updated':
        await this.planCatalog.invalidateCache();
        logger.info(
          { type: event.type },
          'Plan catalog cache invalidated due to Stripe product/price update',
        );
        break;
      default:
        logger.info({ type: event.type }, 'Unhandled Stripe event type — skipping');
    }
  }

  /** Resolve TenantPlan from a Stripe Price ID using the plan catalog */
  private async resolvePlanFromPriceId(priceId: string): Promise<{ plan: TenantPlan } | null> {
    const planDef = await this.planCatalog.getPlanByPriceId(priceId);
    if (planDef) {
      return { plan: planDef.planKey };
    }
    return null;
  }

  async handleCheckoutCompleted(session: StripeSession): Promise<void> {
    const subscriptionRef = session.subscription;
    const subscriptionId =
      typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
    if (!subscriptionId) {
      logger.warn({ sessionId: session.id }, 'checkout.session.completed missing subscription');
      return;
    }
    const tid = session.metadata?.['tenantId'];
    if (!tid) {
      // Try to get tenantId from subscription metadata
      const sub = (await getStripeClient().subscriptions.retrieve(
        subscriptionId,
      )) as unknown as StripeSubscription;
      const subTid = sub.metadata?.['tenantId'];
      if (!subTid) {
        logger.warn({ sessionId: session.id }, 'checkout.session.completed missing tenantId');
        return;
      }
      return this.processCheckout(session, sub, subTid);
    }
    const stripe = getStripeClient();
    const subscription = (await stripe.subscriptions.retrieve(
      subscriptionId,
    )) as unknown as StripeSubscription;
    return this.processCheckout(session, subscription, tid);
  }

  async processCheckout(
    session: StripeSession,
    subscription: StripeSubscription,
    tid: string,
  ): Promise<void> {
    // Find the plan from any subscription item price
    let resolvedPlan: { plan: TenantPlan } | null = null;
    for (const item of subscription.items.data) {
      const priceId = item.price?.id;
      if (priceId) {
        resolvedPlan = await this.resolvePlanFromPriceId(priceId);
        if (resolvedPlan) break;
      }
    }

    const plan: TenantPlan = resolvedPlan?.plan ?? 'starter';

    const customerRef = session.customer;
    const customerId = typeof customerRef === 'string' ? customerRef : customerRef?.id;
    const subscriptionId = subscription.id;
    const periodEnd = getPeriodEndFromSubscription(subscription);

    const isTrialing = subscription.status === 'trialing';

    await this.safeUpdate(tid, {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId,
      plan,
      subscriptionStatus: isTrialing ? 'trialing' : 'active',
      ...(isTrialing && { status: 'trial' }),
      ...(periodEnd && { currentPeriodEnd: periodEnd }),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date().toISOString(),
    });

    // Sync BillingAccount with new plan quotas
    await this.syncBillingAccount(tid, plan);
  }

  async handleInvoicePaid(invoice: StripeInvoice): Promise<void> {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      logger.info({ invoiceId: invoice.id }, 'invoice.paid — no subscription, skipping');
      return;
    }
    const tid = await this.resolveTenantIdFromSubscription(subscriptionId);
    if (!tid) {
      logger.warn({ invoiceId: invoice.id }, 'invoice.paid — could not resolve tenantId');
      return;
    }
    const periodEnd = new Date(invoice.period_end * 1000).toISOString();
    await this.safeUpdate(tid, {
      renewDate: new Date().toISOString(),
      currentPeriodEnd: periodEnd,
      subscriptionStatus: 'active',
      status: 'active',
      updatedAt: new Date().toISOString(),
    });

    // Reset BillingAccount usage counters only on monthly renewal — not on trial conversion or proration
    if (invoice.billing_reason !== 'subscription_cycle') {
      logger.info(
        { invoiceId: invoice.id, billingReason: invoice.billing_reason },
        'invoice.paid — skipping usage reset (not a subscription_cycle renewal)',
      );
      return;
    }

    if (this.billingAccountRepo) {
      try {
        const account = await this.billingAccountRepo.findByTenantId(tenantId(tid));
        if (account) {
          await this.billingAccountRepo.update(tenantId(tid), {
            investigationsUsed: 0,
            eventsUsed: 0,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        logger.warn({ err, tenantId: tid }, 'Failed to reset BillingAccount usage on invoice.paid');
      }
    }
  }

  async handleSubscriptionUpdated(subscription: StripeSubscription): Promise<void> {
    const tid = subscription.metadata?.['tenantId'];
    if (!tid) {
      logger.warn({ subscriptionId: subscription.id }, 'subscription.updated missing tenantId');
      return;
    }

    // Resolve plan from subscription items via catalog
    let resolvedPlan: { plan: TenantPlan } | null = null;
    for (const item of subscription.items.data) {
      const priceId = item.price?.id;
      if (priceId) {
        resolvedPlan = await this.resolvePlanFromPriceId(priceId);
        if (resolvedPlan) break;
      }
    }

    const periodEnd = getPeriodEndFromSubscription(subscription);
    const isTrialing = subscription.status === 'trialing';

    const subscriptionStatus = isTrialing
      ? 'trialing'
      : subscription.status === 'active'
        ? 'active'
        : 'past_due';

    await this.safeUpdate(tid, {
      ...(resolvedPlan && { plan: resolvedPlan.plan }),
      subscriptionStatus,
      ...(isTrialing && { status: 'trial' }),
      ...(subscription.status === 'active' && { status: 'active' }),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...(periodEnd && { currentPeriodEnd: periodEnd }),
      updatedAt: new Date().toISOString(),
    });

    // Sync BillingAccount when plan changes
    if (resolvedPlan) {
      await this.syncBillingAccount(tid, resolvedPlan.plan);
    }
  }

  async handleSubscriptionDeleted(subscription: StripeSubscription): Promise<void> {
    const tid = subscription.metadata?.['tenantId'];
    if (!tid) {
      logger.warn({ subscriptionId: subscription.id }, 'subscription.deleted missing tenantId');
      return;
    }
    // Only cancel if this is the tenant's current subscription (ignore stale/duplicate deletions)
    const tenant = await this.tenantRepo.findById(tenantId(tid));
    if (tenant?.stripeSubscriptionId && tenant.stripeSubscriptionId !== subscription.id) {
      logger.info(
        { subscriptionId: subscription.id, activeSubscriptionId: tenant.stripeSubscriptionId },
        'subscription.deleted — ignoring stale subscription (not the active one)',
      );
      return;
    }
    await this.safeUpdate(tid, {
      plan: 'free',
      subscriptionStatus: 'canceled',
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: undefined,
      updatedAt: new Date().toISOString(),
    });

    // Drop the tenant's BillingAccount quotas to the free plan (0 investigations /
    // 0 events) so gated endpoints return 402 after the subscription is deleted.
    await this.syncBillingAccount(tid, 'free');
  }

  async handlePaymentFailed(invoice: StripeInvoice): Promise<void> {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      logger.info({ invoiceId: invoice.id }, 'invoice.payment_failed — no subscription, skipping');
      return;
    }
    const tid = await this.resolveTenantIdFromSubscription(subscriptionId);
    if (!tid) {
      logger.warn({ invoiceId: invoice.id }, 'invoice.payment_failed — could not resolve tenantId');
      return;
    }
    await this.safeUpdate(tid, {
      subscriptionStatus: 'past_due',
      updatedAt: new Date().toISOString(),
    });
  }

  handleTrialWillEnd(subscription: StripeSubscription): void {
    const tid = subscription.metadata?.['tenantId'];
    if (!tid) {
      logger.warn({ subscriptionId: subscription.id }, 'trial_will_end missing tenantId');
      return;
    }
    // Log for now — notification integration can be added later
    logger.info({ tenantId: tid, subscriptionId: subscription.id }, 'Trial ending soon for tenant');
  }

  /** Sync BillingAccount quotas from Stripe catalog (create if missing). */
  private async syncBillingAccount(tid: string, plan: TenantPlan): Promise<void> {
    if (!this.billingAccountRepo) return;
    try {
      // The free plan is the post-cancellation tier (0 investigations / 0 events).
      // Resolve it directly so the drop-to-free behaviour does not depend on a
      // "free" Price existing in the Stripe account (production accounts
      // typically have no free price). Paid plans resolve via the catalog.
      let investigationsLimit: number | undefined;
      let eventsLimit: number | undefined;
      if (plan === 'free') {
        investigationsLimit = 0;
        eventsLimit = 0;
      } else {
        const planDef = await this.planCatalog.getPlanByKey(plan);
        if (!planDef) return;
        investigationsLimit = planDef.investigationsLimit;
        eventsLimit = planDef.eventsLimit;
      }

      const now = new Date().toISOString();
      const account = await this.billingAccountRepo.findByTenantId(tenantId(tid));
      if (!account) {
        // No BillingAccount yet for this tenant (e.g. tenant created without
        // going through the billing signup flow). Create one so the webhook
        // establishes the BillingAccountEntity for the user.
        await this.billingAccountRepo.create({
          tenantId: tenantId(tid),
          investigationsLimit: investigationsLimit,
          investigationsUsed: 0,
          eventsLimit: eventsLimit,
          eventsUsed: 0,
          createdAt: now,
          updatedAt: now,
        });
        return;
      }
      await this.billingAccountRepo.update(tenantId(tid), {
        investigationsLimit: investigationsLimit,
        eventsLimit: eventsLimit,
        updatedAt: now,
      });
    } catch (err) {
      logger.warn({ err, tenantId: tid, plan }, 'Failed to sync BillingAccount from webhook');
    }
  }

  async resolveTenantIdFromSubscription(subscriptionId: string): Promise<string | undefined> {
    if (!subscriptionId) return undefined;
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.metadata?.['tenantId'];
  }
}
