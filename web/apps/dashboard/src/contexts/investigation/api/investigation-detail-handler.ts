import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * GET /api/investigation/[id]/detail
 * Get investigation detail with evidence grouped by agent.
 */
const _getHandler = withAuth(async (request: NextRequest, ctx, params) => {
  const start = Date.now();
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
  }

  try {
    const client = getApiClient();
    const detail = await client.getInvestigationDetail(id);
    return NextResponse.json(detail);
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
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json({ error: 'Failed to load investigation detail' }, { status });
  }
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _getHandler(request, { params: Promise.resolve(params) });
}
