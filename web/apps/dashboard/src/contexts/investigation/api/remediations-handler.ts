import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * GET /api/remediations
 * List remediations for the authenticated user's tenant.
 *
 * Query params:
 *   - incidentId: required — the incident to list remediations for
 */
export const GET = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  const url = new URL(request.url);
  const incidentId = url.searchParams.get('incidentId');

  if (!incidentId) {
    return NextResponse.json({ error: 'incidentId query parameter is required' }, { status: 400 });
  }

  try {
    const client = getApiClient();
    const remediations = await client.listRemediations(incidentId);
    return NextResponse.json({ remediations });
  } catch (error) {
    const logPath = new URL(request.url).pathname;
    const logPayload = {
      method: request.method,
      path: logPath,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      duration: Date.now() - start,
    };
    dashLogger.error({ err: error, ...logPayload }, `Unhandled API handler error`);
    Sentry.captureException(error, { extra: logPayload });
    return NextResponse.json({ error: 'Failed to load remediations' }, { status: 500 });
  }
});
