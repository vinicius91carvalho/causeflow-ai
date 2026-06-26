import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';

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
  async (request: NextRequest, _ctx) => {
    const { data, error } = await parseBody(request, subscribeSchema);
    if (error) return error;

    try {
      const api = getApiClient();
      const result = await api.createSubscription({ planId: data.planId });
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to create subscription via Core API:', msg);
      return NextResponse.json({ error: `Failed to create subscription: ${msg}` }, { status: 500 });
    }
  },
  { adminOnly: true },
);
