import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

export const GET = withAuth(async (_request, _ctx) => {
  try {
    const triggers = await getApiClient().listTriggers();
    return NextResponse.json({ triggers });
  } catch {
    return NextResponse.json({ triggers: [] });
  }
});

export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const start = Date.now();
    const body = await request.json();
    try {
      const result = await getApiClient().createTrigger(body);
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err, ...logPayload }, `Unhandled API handler error`);
      Sentry.captureException(err, { extra: logPayload });
      const message = err instanceof Error ? err.message : 'Failed to create trigger';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { adminOnly: true },
);
