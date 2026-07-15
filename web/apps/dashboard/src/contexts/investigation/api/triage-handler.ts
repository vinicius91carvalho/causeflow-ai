import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { CoreApiError } from '@/lib/api/http-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

function statusForError(err: unknown): number {
  if (err instanceof CoreApiError) return err.status;
  const msg = err instanceof Error ? err.message : String(err);
  if (/forbidden/i.test(msg)) return 403;
  if (/not.?found/i.test(msg)) return 404;
  if (/unauthori[sz]ed/i.test(msg)) return 401;
  if (/rate.?limit|too.?many/i.test(msg)) return 429;
  return 500;
}

/**
 * POST /api/analyses/[id]/triage
 *
 * Triggers AI triage for the given analysis.
 */
const _postHandler = withAuth(async (request: NextRequest, ctx, params) => {
  const start = Date.now();
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
  }

  try {
    const result = await getApiClient().triggerTriage(id);
    return NextResponse.json(result);
  } catch (error) {
    const httpStatus = statusForError(error);
    if (httpStatus >= 500) {
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err: error, ...logPayload }, 'Unhandled API handler error');
      Sentry.captureException(error, { extra: logPayload });
    }
    const msg = error instanceof Error ? error.message : 'Failed to start triage';
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _postHandler(request, { params: Promise.resolve(params) });
}
