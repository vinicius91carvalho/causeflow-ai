import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/api/get-backend-token';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

const CORE_API_URL = process.env.CORE_API_URL ?? '';

/**
 * GET /api/investigation/[id]/relay-token
 * Proxy to backend to get a JWT for WebSocket relay connection.
 * Uses Clerk session token (BFF pattern) to authenticate with Core API.
 */
export const GET = withAuth(async (request: NextRequest, ctx, params) => {
  const start = Date.now();
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
  }

  if (!CORE_API_URL) {
    return NextResponse.json({ error: 'Core API not configured' }, { status: 503 });
  }

  try {
    const backendToken = await getBackendToken();
    const res = await fetch(
      `${CORE_API_URL}/v1/investigation/${encodeURIComponent(id)}/relay-token`,
      {
        headers: {
          Authorization: `Bearer ${backendToken}`,
        },
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(body, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
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
    return NextResponse.json({ error: 'Failed to get relay token' }, { status: 500 });
  }
});
