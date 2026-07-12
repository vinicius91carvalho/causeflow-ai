import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/integrations/oauth/[provider]/authorize
 *
 * Initiates Composio OAuth flow for the given provider.
 * Calls POST /v1/integrations/connect on the backend to get an authUrl,
 * then redirects the browser (popup) to the provider's OAuth consent screen.
 */
const _getHandler = withAuth(async (request: NextRequest, _ctx, params) => {
  const provider = params?.provider;

  if (!provider) {
    return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
  }

  // Build the callback URL that Composio will redirect to after OAuth consent
  const origin = new URL(request.url).origin;
  const redirectUrl = `${origin}/api/integrations/oauth/${provider}/callback`;

  const { authUrl } = await getApiClient().initiateOAuthConnect(provider, redirectUrl);
  if (!authUrl) {
    return NextResponse.json({ error: 'OAuth authorization URL unavailable' }, { status: 502 });
  }
  return NextResponse.redirect(authUrl);
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _getHandler(request, { params: Promise.resolve(params) });
}
