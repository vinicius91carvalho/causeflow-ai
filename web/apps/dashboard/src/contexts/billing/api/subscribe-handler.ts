import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ossBillingGoneResponse } from '@/contexts/billing/application/oss-billing-gone';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

const subscribeSchema = z.object({
  planId: z.enum(['starter', 'pro', 'business']),
});

/**
 * POST /api/billing/subscribe
 * Proxies to Core API POST /v1/billing/subscribe.
 * Returns { subscriptionId, clientSecret } for Stripe Payment Element.
 *
 * Requires: admin role (MANAGE_BILLING permission)
 */
export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const ossGone = ossBillingGoneResponse();
    if (ossGone) return ossGone;

    const start = Date.now();
    const { data, error } = await parseBody(request, subscribeSchema);
    if (error) return error;

    try {
      const api = getApiClient();
      const result = await api.createSubscription({ planId: data.planId });
      return NextResponse.json(result);
    } catch (err) {
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
      return NextResponse.json({ error: `Failed to create subscription: ${msg}` }, { status: 500 });
    }
  },
  { adminOnly: true },
);
