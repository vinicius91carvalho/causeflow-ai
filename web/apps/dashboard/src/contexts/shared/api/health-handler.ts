import { NextResponse } from 'next/server';
import { NO_CACHE_HEADERS } from '@/lib/api/headers';

/**
 * GET /api/health
 *
 * Health check endpoint used by:
 *   - CloudWatch synthetic monitoring
 *   - Load balancer health checks
 *   - Deployment verification scripts
 *
 * Returns 200 OK when the application is running normally.
 * This endpoint is intentionally simple and does NOT check
 * database connectivity (to keep it fast and dependency-free).
 *
 * For deep health checks (DB, KMS connectivity), a separate
 * /api/health/deep endpoint can be added.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'ok',
      version: process.env.APP_VERSION ?? '0.1.0',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        ...NO_CACHE_HEADERS,
        // No authentication required for health checks
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
