import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

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
 */
export const POST = withAuth(async (request: NextRequest, _ctx) => {
  const origin = request.nextUrl.origin;
  const returnUrl = `${origin}/dashboard/billing`;

  try {
    const api = getApiClient();
    const result = await api.createPortalSession({ returnUrl });
    return NextResponse.json({ url: result.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to create portal session:', msg);
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 });
  }
});
