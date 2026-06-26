import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/github/callback
 *
 * Handles the GitHub App installation callback.
 * Reads installation_id and code from search params,
 * then redirects to the integrations page.
 */
export const GET = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const installationId = url.searchParams.get('installation_id');
  const code = url.searchParams.get('code');

  if (!installationId) {
    return NextResponse.json({ error: 'installation_id is required' }, { status: 400 });
  }

  await getApiClient().setupGitHubApp(Number(installationId), code ?? '');

  const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
  return NextResponse.redirect(`${baseUrl}/dashboard/integrations?github=installed`);
});
