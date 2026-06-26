import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * Max number of retries when polling Core API for a fresh subscription
 * after a successful Stripe Checkout redirect. Stripe fires the activation
 * webhook concurrently with the browser redirect, so there is a short
 * window where our DB is still stale. 5 retries × 500ms ≈ 2.5s of patience
 * — long enough for the common case, short enough to feel responsive.
 */
const MAX_POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForActivePlan(): Promise<boolean> {
  const api = getApiClient();
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const sub = (await api.getSubscription()) as {
        status?: string;
        currentPeriodEnd?: string | null;
      } | null;
      const statusOk = ['active', 'trialing'].includes(sub?.status ?? '');
      // Use currentPeriodEnd as the Stripe-marker — the Core API's
      // GetSubscriptionUseCase does not expose stripeCustomerId in its
      // response. currentPeriodEnd is set by every Stripe webhook event
      // (checkout.session.completed, customer.subscription.updated) so
      // it is equally reliable as proof that the tenant completed checkout.
      const hasStripeSubscription = Boolean(sub?.currentPeriodEnd);
      if (statusOk && hasStripeSubscription) return true;
    } catch {
      // Treat transient errors the same as "not yet active" and retry.
    }
    if (attempt < MAX_POLL_ATTEMPTS - 1) await sleep(POLL_DELAY_MS);
  }
  return false;
}

/**
 * GET /api/billing/checkout/complete
 *
 * Stripe redirects here after a successful Checkout session. Since the
 * Stripe `checkout.session.completed` webhook fires concurrently with the
 * redirect, the Core API's subscription record may be stale by microseconds.
 * We poll briefly until we see BOTH an active/trialing status AND a real
 * `stripeCustomerId` (defeating the Core API's "active by default" behavior
 * for fresh tenants).
 *
 * On success: redirect to /onboarding/integrations (onboarding)
 * or /dashboard/billing?success=1 (upgrade). The dashboard layout server
 * component re-verifies via {@link getPlanStatus}, so there is no cookie
 * involved — the source of truth is always the Core API.
 *
 * On failure (poll timeout): redirect back to /onboarding/choose-plan
 * with `?payment_failed=1`.
 *
 * Requires: admin role (org owner just completed checkout).
 */
export const GET = withAuth(
  async (request: NextRequest, _ctx) => {
    const origin = request.nextUrl.origin;
    const from = request.nextUrl.searchParams.get('from') ?? 'onboarding';
    const plan = request.nextUrl.searchParams.get('plan');

    const hasActivePlan = await pollForActivePlan();

    if (hasActivePlan) {
      const destination =
        from === 'billing'
          ? `/dashboard/billing?success=1${plan ? `&plan=${plan}` : ''}`
          : '/onboarding/integrations';
      return NextResponse.redirect(new URL(destination, origin));
    }

    return NextResponse.redirect(new URL('/onboarding/choose-plan?payment_failed=1', origin));
  },
  { adminOnly: true },
);
