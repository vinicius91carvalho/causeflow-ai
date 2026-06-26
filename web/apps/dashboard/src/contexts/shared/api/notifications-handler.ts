import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/notifications?limit=10&cursor=...
 *
 * Lists notifications for the current user's tenant.
 * Used by the NotificationBell component.
 *
 * This route runs server-side so getApiClient() has access to
 * CORE_API_URL without exposing it to the client bundle.
 */
export const GET = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 100);
  const cursor = url.searchParams.get('cursor') ?? undefined;

  const result = await getApiClient().listNotifications({ limit, cursor });
  return NextResponse.json(result);
});

/**
 * PATCH /api/notifications/:id/read
 *
 * Mark a notification as read.
 * Used by the NotificationBell component.
 */
export const PATCH = withAuth(async (request: NextRequest) => {
  let body: { notificationId?: string };
  try {
    body = (await request.json()) as { notificationId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
  }

  await getApiClient().markNotificationRead(body.notificationId);
  return NextResponse.json({ ok: true });
});
