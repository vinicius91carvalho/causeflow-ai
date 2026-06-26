import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/billing/plans
 * Returns available plans from the backend Stripe catalog.
 * Falls back to empty array if the backend endpoint is not yet deployed.
 */
export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const plans = await getApiClient().getPlans();
    return NextResponse.json({ plans });
  } catch {
    // Backend may not have /v1/billing/plans deployed yet — return empty
    return NextResponse.json({ plans: [] });
  }
});
