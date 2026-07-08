import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * GET /api/approvals
 * List pending approvals for the authenticated user's tenant.
 */
export const GET = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  try {
    const approvals = await getApiClient().listPendingApprovals();
    return NextResponse.json({ approvals });
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
    return NextResponse.json({ error: 'Failed to load approvals' }, { status: 500 });
  }
});
