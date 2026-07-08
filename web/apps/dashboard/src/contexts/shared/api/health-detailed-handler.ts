import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

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
      // AC-042: log the upstream failure with a structured payload and
      // forward to Sentry, then return a degraded 200 so the UI keeps
      // rendering. This is a graceful-degradation branch (status 200),
      // not a non-recoverable 500 — the same redaction applies via the
      // logger's REDACT_PATHS.
      dashLogger.error(
        { err: error, method: 'GET', path: '/api/health/detailed' },
        'Failed to fetch detailed health from backend',
      );
      Sentry.captureException(error, {
        extra: { method: 'GET', path: '/api/health/detailed' },
      });
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
