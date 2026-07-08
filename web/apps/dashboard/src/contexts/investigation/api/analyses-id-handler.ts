import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * GET /api/analyses/[id]
 * Get a single incident by incidentId.
 */
const _getHandler = withAuth(async (request: NextRequest, ctx, params) => {
  const start = Date.now();
  const incidentId = params?.id;

  if (!incidentId) {
    return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
  }

  try {
    const client = getApiClient();
    const incident = await client.getIncident(incidentId);
    return NextResponse.json({ incident });
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('404') || message.includes('not found')) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load incident' }, { status: 500 });
  }
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _getHandler(request, { params: Promise.resolve(params) });
}
