import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/pattern-analytics
 *
 * Returns pattern analytics data (top categories, confidence distribution,
 * resolution rates) for the current tenant.
 *
 * Used by the PatternInsights component on the dashboard overview.
 * This route runs server-side so getApiClient() has access to
 * CORE_API_URL without exposing it to the client bundle.
 *
 * Cached for 5 minutes with 10 minutes stale-while-revalidate.
 * Pattern data changes infrequently and is expensive to compute.
 */
export const GET = withAuth(async (_request, _ctx) => {
  const analytics = await getApiClient().getPatternAnalytics();
  return NextResponse.json(analytics, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
});
