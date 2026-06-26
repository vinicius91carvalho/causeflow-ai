import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/health/detailed
 *
 * Returns detailed health status from the Core API client,
 * including dependency checks (DynamoDB, Cognito, KMS).
 *
 * Used by the SystemStatus component on the dashboard overview.
 * This route runs server-side so getApiClient() has access to
 * CORE_API_URL without exposing it to the client bundle.
 *
 * Cached for 30s with 60s stale-while-revalidate to reduce load
 * while still providing reasonably fresh health data.
 *
 * Uses `allowNoOrg` so it works even before the user selects an organization.
 */
export const GET = withAuth(
  async (_request, _ctx) => {
    try {
      const status = await getApiClient().healthDetailed();
      return NextResponse.json(status, {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      });
    } catch (error) {
      console.error('[health-detailed] Failed to fetch from backend:', error);
      // Return a degraded status instead of failing entirely
      return NextResponse.json(
        {
          status: 'degraded' as const,
          version: 'unknown',
          timestamp: new Date().toISOString(),
          dependencies: [],
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-cache',
          },
        },
      );
    }
  },
  { allowNoOrg: true },
);
