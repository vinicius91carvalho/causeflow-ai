import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/api/get-backend-token';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

const CORE_API_URL = process.env.CORE_API_URL ?? '';

/**
 * GET /api/investigation/[id]/chat
 * Load conversation history for investigation follow-up chat.
 */
export const GET = withAuth(async (_request: NextRequest, _ctx, params) => {
  const id = params?.id;
  if (!id || !CORE_API_URL) {
    return NextResponse.json({ messages: [] });
  }

  try {
    const backendToken = await getBackendToken();
    const res = await fetch(`${CORE_API_URL}/v1/investigation/${encodeURIComponent(id)}/chat`, {
      headers: { Authorization: `Bearer ${backendToken}` },
    });
    if (!res.ok) return NextResponse.json({ messages: [] });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ messages: [] });
  }
});

/**
 * POST /api/investigation/[id]/chat
 * Send a follow-up message about a completed investigation.
 */
export const POST = withAuth(async (request: NextRequest, ctx, params) => {
  const start = Date.now();
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
  }
  if (!CORE_API_URL) {
    return NextResponse.json({ error: 'Core API not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const backendToken = await getBackendToken();
    const res = await fetch(`${CORE_API_URL}/v1/investigation/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backendToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(data, { status: res.status });
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
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
});
