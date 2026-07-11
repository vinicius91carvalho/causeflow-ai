import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { billingDisabledResponse } from '@/contexts/billing/application/billing-disabled';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * POST /api/billing/portal
 * Delegates to backend to create a Stripe Customer Portal session.
 *
 * Allowed for: any authenticated tenant member (admin or member).
 * The Stripe Customer Portal is scoped per-tenant — the customer ID is
 * looked up from the session's tenant, never from request input. Members
 * can open the portal in read mode; what they can do inside the portal
 * is controlled by the Stripe Portal configuration, not by this handler.
 *
 * Response: { url: string } — redirect the user to this URL
 * OSS (AC-048): Core returns 410 Gone → clear "billing disabled" message.
 */
export const POST = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  const origin = request.nextUrl.origin;
  const returnUrl = `${origin}/dashboard/billing`;

  try {
    const api = getApiClient();
    const result = await api.createPortalSession({ returnUrl });
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
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 });
  }
});
