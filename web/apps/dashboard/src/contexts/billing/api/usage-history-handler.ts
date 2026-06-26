import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/billing/usage-history
 *
 * Combines /v1/billing/credits + /v1/billing/usage from the backend
 * into the shape the frontend UsageHistory component expects.
 */
export const GET = withAuth(async (request: NextRequest) => {
  const days = Number(request.nextUrl.searchParams.get('days') ?? '30');
  const limit = Math.min(days, 100);

  const [credits, usage] = await Promise.all([
    getApiClient().getCredits(),
    getApiClient().getUsageHistory(limit),
  ]);

  return NextResponse.json({
    investigations: {
      limit: credits.investigations?.total ?? 0,
      used: credits.investigations?.used ?? 0,
      remaining: credits.investigations?.remaining ?? 0,
    },
    events: {
      limit: credits.events?.total ?? 0,
      used: credits.events?.used ?? 0,
      remaining: credits.events?.remaining ?? 0,
    },
    records: usage.records ?? [],
  });
});
