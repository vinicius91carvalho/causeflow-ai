import { type NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/api/get-backend-token';

/**
 * GET /api/integrations/slack/oauth
 *
 * Initiates the CauseFlow AI Slack App OAuth flow for notifications.
 * Server-side: fetches a Clerk JWT, calls the Core API authorize endpoint
 * with it (which requires admin auth), captures the redirect to Slack's
 * OAuth consent page, and redirects the browser there.
 *
 * After consent, Slack redirects to the Core API callback which then
 * redirects back to /dashboard/settings?tab=notifications&slack=connected.
 */
export async function handleSlackOAuthStart(req: NextRequest): Promise<NextResponse> {
  const coreApiUrl = process.env.CORE_API_URL;
  if (!coreApiUrl) {
    return NextResponse.json({ error: 'CORE_API_URL not configured' }, { status: 500 });
  }

  let token: string;
  try {
    token = await getBackendToken();
  } catch {
    return NextResponse.redirect(new URL('/auth/sign-in', req.url));
  }

  const res = await fetch(`${coreApiUrl}/v1/integrations/slack/oauth/authorize`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'manual',
  });

  const location = res.headers.get('location');
  if (location) {
    return NextResponse.redirect(location);
  }

  const body = await res.text().catch(() => '');
  return NextResponse.json(
    { error: 'Slack OAuth initiation failed', status: res.status, details: body },
    { status: 500 },
  );
}
