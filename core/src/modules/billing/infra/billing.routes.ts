import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateCheckoutUseCase } from '../application/create-checkout.usecase.js';
import type { CreatePortalUseCase } from '../application/create-portal.usecase.js';
import type { GetSubscriptionUseCase } from '../application/get-subscription.usecase.js';
import type { HandleWebhookUseCase } from '../application/handle-webhook.usecase.js';
import type { GetUsageUseCase } from '../application/get-usage.usecase.js';
import type { SignupUseCase } from '../application/signup.usecase.js';
import type { PurchaseQuotaPackUseCase } from '../application/purchase-quota-pack.usecase.js';
import type { UpdateBillingSettingsUseCase } from '../application/update-billing-settings.usecase.js';
import type { GetCreditsUseCase } from '../application/get-credits.usecase.js';
import type { ListPlansUseCase } from '../application/list-plans.usecase.js';
import type { UpgradeSubscriptionUseCase } from '../application/upgrade-subscription.usecase.js';
import type { ListInvoicesUseCase } from '../application/list-invoices.usecase.js';
import type { CancelSubscriptionUseCase } from '../application/cancel-subscription.usecase.js';
import type { ReactivateSubscriptionUseCase } from '../application/reactivate-subscription.usecase.js';
import type { CreateSubscriptionUseCase } from '../application/create-subscription.usecase.js';

/**
 * BillingUseCases — all fields are optional so the open-source local runtime
 * (AC-043) can omit Stripe-dependent use cases without importing Stripe.
 * Routes guard against missing use cases and return 410 Gone with a clear
 * message when the billing feature is disabled in the OSS build.
 */
export interface BillingUseCases {
  createCheckout?: CreateCheckoutUseCase;
  createPortal?: CreatePortalUseCase;
  getSubscription?: GetSubscriptionUseCase;
  handleWebhook?: HandleWebhookUseCase;
  getUsage?: GetUsageUseCase;
  getCredits?: GetCreditsUseCase;
  signup?: SignupUseCase;
  purchaseQuotaPack?: PurchaseQuotaPackUseCase;
  updateBillingSettings?: UpdateBillingSettingsUseCase;
  listPlans?: ListPlansUseCase;
  upgradeSubscription?: UpgradeSubscriptionUseCase;
  listInvoices?: ListInvoicesUseCase;
  cancelSubscription?: CancelSubscriptionUseCase;
  reactivateSubscription?: ReactivateSubscriptionUseCase;
  createSubscription?: CreateSubscriptionUseCase;
}

const checkoutSchema = z.object({
  planKey: z.enum(['starter', 'pro', 'business']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
const portalSchema = z.object({
  returnUrl: z.string().url(),
});
export function createBillingRoutes(useCases: BillingUseCases) {
  const app = new Hono<AppEnv>();
  // GET /v1/billing/plans — list available plans from Stripe (public, for pricing page)
  if (useCases.listPlans) {
    app.get('/plans', async (c) => {
      const result = await useCases.listPlans!.execute();
      return c.json(result);
    });
  }
  // POST /v1/billing/subscribe — create subscription with Payment Element (admin only)
  if (useCases.createSubscription) {
    const subscribeSchema = z.object({
      planId: z.string().min(1),
    });
    app.post('/subscribe', requireRole('admin'), zValidator('json', subscribeSchema), async (c) => {
      const tenantId = c.get('tenantId');
      const { planId } = c.req.valid('json');
      const result = await useCases.createSubscription!.execute({ tenantId, planId });
      return c.json(result);
    });
  }
  // POST /v1/billing/checkout — create Checkout session (admin only)
  // In the OSS runtime (AC-043), billing is disabled — returns 410 Gone.
  app.post('/checkout', requireRole('admin'), zValidator('json', checkoutSchema), async (c) => {
    if (!useCases.createCheckout) {
      return c.json(
        { error: 'Billing is disabled in the OSS build. Checkout is not available.' },
        410,
      );
    }
    const tenantId = c.get('tenantId');
    const input = c.req.valid('json');
    const result = await useCases.createCheckout.execute({
      tenantId,
      planKey: input.planKey,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
    return c.json(result);
  });
  // POST /v1/billing/checkout-session — alias for /checkout (AC-043 canonical path)
  app.post(
    '/checkout-session',
    requireRole('admin'),
    zValidator('json', checkoutSchema),
    async (c) => {
      if (!useCases.createCheckout) {
        return c.json(
          { error: 'Billing is disabled in the OSS build. Checkout is not available.' },
          410,
        );
      }
      const tenantId = c.get('tenantId');
      const input = c.req.valid('json');
      const result = await useCases.createCheckout.execute({
        tenantId,
        planKey: input.planKey,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
      return c.json(result);
    },
  );
  // POST /v1/billing/portal — create Billing Portal session (admin only)
  // In the OSS runtime (AC-043), billing is disabled — returns 410 Gone.
  app.post('/portal', requireRole('admin'), zValidator('json', portalSchema), async (c) => {
    if (!useCases.createPortal) {
      return c.json(
        { error: 'Billing is disabled in the OSS build. Portal is not available.' },
        410,
      );
    }
    const tenantId = c.get('tenantId');
    const input = c.req.valid('json');
    const result = await useCases.createPortal.execute({
      tenantId,
      returnUrl: input.returnUrl,
    });
    return c.json(result);
  });
  // GET /v1/billing/subscription — get current subscription info (any authenticated role)
  // In the OSS runtime (AC-043), returns {"plan":"free","status":"active"} for every tenant.
  app.get('/subscription', async (c) => {
    if (!useCases.getSubscription) {
      return c.json({ plan: 'free', status: 'active' });
    }
    const tenantId = c.get('tenantId');
    const result = await useCases.getSubscription.execute(tenantId);
    return c.json(result);
  });
  // GET /v1/billing/credits — get credit balances (investigations + events)
  if (useCases.getCredits) {
    app.get('/credits', async (c) => {
      const tenantId = c.get('tenantId');
      const result = await useCases.getCredits!.execute(tenantId);
      return c.json(result);
    });
  }
  // GET /v1/billing/usage — get usage records and billing account info
  app.get('/usage', async (c) => {
    if (!useCases.getUsage) {
      return c.json({ account: null, records: [] });
    }
    const tenantId = c.get('tenantId');
    const limit = Number(c.req.query('limit') ?? '50');
    const cursor = c.req.query('cursor');
    const type = c.req.query('type') as
      | import('../../../shared/domain/types.js').UsageType
      | undefined;
    const result = await useCases.getUsage.execute(tenantId, { limit, cursor, type });
    return c.json(result);
  });
  // GET /v1/billing/invoices — list Stripe invoices (any authenticated role)
  if (useCases.listInvoices) {
    app.get('/invoices', async (c) => {
      const tenantId = c.get('tenantId');
      const limit = Number(c.req.query('limit') ?? '12');
      const result = await useCases.listInvoices!.execute(tenantId, limit);
      return c.json(result);
    });
  }
  // POST /v1/billing/purchase — purchase a quota pack (admin/owner only)
  if (useCases.purchaseQuotaPack) {
    const purchaseSchema = z.object({
      type: z.enum(['investigation', 'event']),
    });
    app.post('/purchase', requireRole('admin'), zValidator('json', purchaseSchema), async (c) => {
      const tenantId = c.get('tenantId');
      const { type } = c.req.valid('json');
      const result = await useCases.purchaseQuotaPack!.execute({ tenantId, type });
      return c.json(result);
    });
  }
  // POST /v1/billing/upgrade — upgrade/downgrade subscription plan (admin/owner only)
  if (useCases.upgradeSubscription) {
    const upgradeSchema = z.object({
      targetPlanKey: z.enum(['starter', 'pro', 'business', 'enterprise']),
    });
    app.post('/upgrade', requireRole('admin'), zValidator('json', upgradeSchema), async (c) => {
      const tenantId = c.get('tenantId');
      const { targetPlanKey } = c.req.valid('json');
      const result = await useCases.upgradeSubscription!.execute({ tenantId, targetPlanKey });
      return c.json(result);
    });
  }
  // POST /v1/billing/cancel — schedule subscription cancellation (admin/owner only)
  if (useCases.cancelSubscription) {
    app.post('/cancel', requireRole('admin'), async (c) => {
      const tenantId = c.get('tenantId');
      const result = await useCases.cancelSubscription!.execute(tenantId);
      return c.json(result);
    });
  }
  // POST /v1/billing/reactivate — reactivate a canceling subscription (admin/owner only)
  if (useCases.reactivateSubscription) {
    app.post('/reactivate', requireRole('admin'), async (c) => {
      const tenantId = c.get('tenantId');
      const result = await useCases.reactivateSubscription!.execute(tenantId);
      return c.json(result);
    });
  }
  // PUT /v1/billing/settings — update billing settings (admin/owner only)
  if (useCases.updateBillingSettings) {
    const settingsSchema = z.object({
      overagePolicy: z.enum(['block', 'auto_charge', 'manual']).optional(),
    });
    app.put('/settings', requireRole('admin'), zValidator('json', settingsSchema), async (c) => {
      const tenantId = c.get('tenantId');
      const input = c.req.valid('json');
      const result = await useCases.updateBillingSettings!.execute({ tenantId, ...input });
      return c.json(result);
    });
  }
  return app;
}
export function createSignupRoute(useCases: BillingUseCases) {
  const app = new Hono();
  if (useCases.signup) {
    const signupSchema = z.object({
      name: z.string().min(2),
      slug: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/),
      ownerEmail: z.string().email(),
      plan: z.enum(['starter', 'pro', 'business', 'enterprise']).optional(),
    });
    // POST /v1/signup — public endpoint for self-service signup
    app.post('/', zValidator('json', signupSchema), async (c) => {
      const input = c.req.valid('json');
      const result = await useCases.signup!.execute(input);
      return c.json(
        {
          tenantId: result.tenant.tenantId,
          name: result.tenant.name,
          slug: result.tenant.slug,
          plan: result.tenant.plan,
          investigationsLimit: result.billingAccount.investigationsLimit,
          eventsLimit: result.billingAccount.eventsLimit,
        },
        201,
      );
    });
  }
  return app;
}
export function createBillingWebhookRoute(useCases: BillingUseCases) {
  const app = new Hono();
  // POST /v1/billing/webhook — Stripe webhook (NO auth, signature verified internally)
  // In the OSS runtime (AC-043), billing is disabled — returns 410 Gone.
  app.post('/webhook', async (c) => {
    if (!useCases.handleWebhook) {
      return c.json(
        { error: 'Billing is disabled in the OSS build. Webhooks are not accepted.' },
        410,
      );
    }
    const rawBody = await c.req.text();
    const signature = c.req.header('stripe-signature') ?? '';
    await useCases.handleWebhook.execute(rawBody, signature);
    return c.json({ received: true });
  });
  return app;
}
