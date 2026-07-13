import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { billingDisabledResponse } from '@/contexts/billing/application/billing-disabled';
import { ossBillingGoneResponse } from '@/contexts/billing/application/oss-billing-gone';
import { checkoutSchema } from '@/contexts/billing/infrastructure/api-schema';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth, type RouteContext } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * POST /api/billing/checkout
 * Delegates to the backend Core API to create a Stripe Checkout session.
 *
 * Requires: admin role (MANAGE_BILLING permission)
 *
 * Request body: { planId: 'starter' | 'pro' | 'business', from?: 'onboarding' | 'billing' }
 *
 * Response: { url: string } — redirect the user to this URL
 * OSS (AC-048): Core returns 410 Gone → clear "billing disabled" message.
 */
const postCheckout = withAuth(
  async (request: NextRequest, ctx) => {
    const start = Date.now();
    const { data, error } = await parseBody(request, checkoutSchema);
    if (error) return error;

    const { planId, from } = data;

    const origin = request.nextUrl.origin;
    const baseUrl = process.env.NEXTAUTH_URL || origin;
    const isOnboarding = from === 'onboarding';
    // Route through the checkout-complete handler so it can verify the subscription
    // and set the cf_plan_active cookie before redirecting to the final destination.
    const successUrl = isOnboarding
      ? `${baseUrl}/api/billing/checkout/complete`
      : `${baseUrl}/api/billing/checkout/complete?from=billing&plan=${planId}`;
    const cancelUrl = isOnboarding
      ? `${baseUrl}/onboarding/choose-plan?canceled=1`
      : `${baseUrl}/dashboard/billing?canceled=1`;

    try {
      const api = getApiClient();
      const result = await api.createCheckout({ planKey: planId, successUrl, cancelUrl });
      return NextResponse.json({ url: result.url });
    } catch (err) {
      const disabled = billingDisabledResponse(err);
      if (disabled) {
        return NextResponse.json({ error: disabled.error }, { status: disabled.status });
      }
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err: err, ...logPayload }, `Unhandled API handler error`);
      Sentry.captureException(err, { extra: logPayload });
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Failed to create checkout session: ${msg}` },
        { status: 500 },
      );
    }
  },
  { adminOnly: true },
);

export async function POST(
  request: NextRequest,
  routeContext: RouteContext,
): Promise<NextResponse> {
  const ossGone = ossBillingGoneResponse();
  if (ossGone) return ossGone;
  return postCheckout(request, routeContext);
}
