import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { billingDisabledResponse } from '@/contexts/billing/application/billing-disabled';
import { checkoutSchema } from '@/contexts/billing/infrastructure/api-schema';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * Replace loopback hostnames (`localhost`, `127.0.0.1`, `0.0.0.0`) with a
 * public-DNS loopback alias (`lvh.me`) that points at 127.0.0.1 for every
 * resolver. The Core API is fronted by a WAF that rejects any request body
 * containing `localhost` or loopback IPs (SSRF protection). Stripe accepts
 * `lvh.me` URLs, and browsers resolve `lvh.me` back to 127.0.0.1 so success/
 * cancel redirects still land on the local dev server.
 *
 * No-op in production where URLs use the real dashboard hostname.
 */
function rewriteLoopbackForWaf(url: string): string {
  return url.replace(/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/g, 'lvh.me');
}

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
export const POST = withAuth(
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
    const rawSuccessUrl = isOnboarding
      ? `${baseUrl}/api/billing/checkout/complete`
      : `${baseUrl}/api/billing/checkout/complete?from=billing&plan=${planId}`;
    const rawCancelUrl = isOnboarding
      ? `${baseUrl}/onboarding/choose-plan?canceled=1`
      : `${baseUrl}/dashboard/billing?canceled=1`;

    // Sanitize loopback hostnames for the Core API's WAF — see helper JSDoc.
    const successUrl = rewriteLoopbackForWaf(rawSuccessUrl);
    const cancelUrl = rewriteLoopbackForWaf(rawCancelUrl);

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
