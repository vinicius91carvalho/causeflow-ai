import { cache } from 'react';
import { getApiClient } from '@/lib/api/get-api-client';

export interface PlanStatus {
  /** True only when status is active/trialing AND the tenant has a real Stripe subscription. */
  hasActivePlan: boolean;
  plan: string | null;
  status: string | null;
  /** ISO timestamp at which the current Stripe billing period ends. null when the tenant has never completed checkout. */
  currentPeriodEnd: string | null;
  /** True when the Core API reports a real Stripe-managed subscription (presence of currentPeriodEnd). */
  hasStripeSubscription: boolean;
}

/**
 * Computes plan status from the Core API's GET /v1/billing/subscription.
 *
 * A plan is "active" only when BOTH:
 *   1. `status` is 'active' or 'trialing'
 *   2. `currentPeriodEnd` is set — Stripe webhooks populate this on every
 *      real subscription update (checkout.session.completed,
 *      customer.subscription.updated). Fresh tenants that have never
 *      touched Stripe never have this field.
 *
 * Why cross-check: the Core API defaults `status` to 'active' for fresh
 * tenants that have never touched Stripe — `tenant.subscriptionStatus` is
 * undefined, so `get-subscription.usecase.ts` falls back to `'active'`.
 * Without cross-checking a Stripe-only field, every brand-new tenant would
 * silently skip the plan gate — this is the bug that let vinicius@causeflow.ai
 * into /dashboard without paying.
 *
 * We use `currentPeriodEnd` rather than `stripeCustomerId` because the
 * Core API's `GetSubscriptionUseCase` does not currently expose
 * `stripeCustomerId` in its response (see
 * `core/src/modules/billing/application/get-subscription.usecase.ts`).
 * Both fields are set by the Stripe webhook flow, so either one is a
 * valid proxy for "this tenant completed checkout".
 *
 * This is the uncached form — prefer {@link getPlanStatus} from server
 * components so React de-duplicates per request.
 */
export async function fetchPlanStatus(): Promise<PlanStatus> {
  try {
    const api = getApiClient();
    const sub = (await api.getSubscription()) as {
      status?: string;
      plan?: string;
      currentPeriodEnd?: string | null;
    } | null;

    const statusOk = ['active', 'trialing'].includes(sub?.status ?? '');
    const currentPeriodEnd = sub?.currentPeriodEnd ?? null;
    const hasStripeSubscription = Boolean(currentPeriodEnd);

    // OSS local runtime: Core returns { plan: 'free', status: 'active' } with no
    // currentPeriodEnd because Stripe is disabled (AC-043/AC-048). Allow dashboard
    // access without a Stripe checkout so integration and other features are testable.
    const ossBillingDisabled =
      !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      sub?.plan === 'free' &&
      sub?.status === 'active' &&
      currentPeriodEnd == null;

    return {
      hasActivePlan: ossBillingDisabled || (statusOk && hasStripeSubscription),
      plan: sub?.plan ?? null,
      status: sub?.status ?? null,
      currentPeriodEnd,
      hasStripeSubscription,
    };
  } catch {
    // OSS local runtime: when Stripe is disabled and Core subscription fetch fails
    // (transient proxy error), still allow dashboard access so RBAC and other
    // features remain testable without a Stripe checkout (AC-043/AC-048).
    const ossBillingDisabled = !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (ossBillingDisabled) {
      return {
        hasActivePlan: true,
        plan: 'free',
        status: 'active',
        currentPeriodEnd: null,
        hasStripeSubscription: false,
      };
    }
    return {
      hasActivePlan: false,
      plan: null,
      status: null,
      currentPeriodEnd: null,
      hasStripeSubscription: false,
    };
  }
}

/**
 * Cached plan status reader for server components. React `cache()` dedupes
 * calls within a single request render, so layouts + pages that each need
 * the status only hit Core API once per navigation.
 */
export const getPlanStatus = cache(fetchPlanStatus);
