import { type NextRequest, NextResponse } from 'next/server';
import { resolveCredits } from '@/contexts/billing/application/credits-ledger';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/billing/subscription
 * Returns the current tenant's subscription and credits state.
 * Delegates to backend GET /v1/billing/subscription which has the real
 * subscription status from Stripe webhooks.
 *
 * `hasStripeCustomer` is derived from `currentPeriodEnd` (not
 * `stripeCustomerId`). The Core API's `GetSubscriptionUseCase` does not
 * currently expose `stripeCustomerId` in its response shape — only
 * `currentPeriodEnd`, which is populated exclusively by Stripe webhooks
 * (checkout.session.completed, customer.subscription.updated). Its presence
 * is therefore a reliable marker that the tenant actually completed checkout.
 *
 * Why cross-check at all: the Core API defaults subscription status to
 * "active" for fresh tenants that never touched Stripe (see
 * `core/src/modules/billing/application/get-subscription.usecase.ts`:
 * `status: tenant.subscriptionStatus ?? 'active'`). Without a Stripe-only
 * marker, every brand-new tenant would silently skip the plan gate — the
 * exact bug that let vinicius@causeflow.ai into /dashboard without paying.
 *
 * The response field name is kept as `hasStripeCustomer` for backwards
 * compatibility with `choose-plan-page.tsx` and `billing-content.tsx` —
 * the semantic is "does this tenant have a real Stripe-managed subscription".
 *
 * Allowed for: any authenticated tenant member (read-only — members
 * carry VIEW_BILLING). Mutating endpoints (checkout, subscribe) remain
 * admin-only in their own handlers.
 */
export const GET = withAuth(async (_request: NextRequest, ctx) => {
  const api = getApiClient();

  const sub = (await api.getSubscription()) as {
    plan?: string;
    status?: string;
    investigationsLimit?: number;
    investigationsUsed?: number;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    renewDate?: string | null;
  } | null;

  const currentPeriodEnd = sub?.currentPeriodEnd ?? null;
  const credits = resolveCredits(ctx.tenantId, {
    plan: sub?.plan,
    status: sub?.status,
    investigationsLimit: sub?.investigationsLimit,
    investigationsUsed: sub?.investigationsUsed,
    currentPeriodEnd,
    renewDate: sub?.renewDate ?? null,
  });

  return NextResponse.json({
    plan: credits.plan,
    subscriptionStatus: credits.subscriptionStatus,
    creditsTotal: credits.creditsTotal,
    creditsUsed: credits.creditsUsed,
    creditsRemaining: Number.isFinite(credits.creditsRemaining)
      ? credits.creditsRemaining
      : credits.creditsTotal,
    currentPeriodEnd,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    hasStripeCustomer: Boolean(currentPeriodEnd),
    renewDate: credits.renewDate,
  });
});
