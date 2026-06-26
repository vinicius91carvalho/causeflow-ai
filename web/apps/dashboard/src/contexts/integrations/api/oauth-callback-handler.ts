import { INTEGRATIONS } from '@causeflow/shared/constants';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/** Set of known provider IDs for validation. */
const KNOWN_PROVIDER_IDS = new Set(INTEGRATIONS.map((i) => i.id));

/**
 * GET /api/integrations/oauth/[provider]/callback
 *
 * Handles the redirect back from the OAuth consent screen.
 *
 * Two distinct flows are supported:
 *
 * 1. Classic OAuth (has `code` param) — popup/postMessage flow.
 *    Exchanges the code via Core API and renders a self-closing HTML page
 *    that notifies the opener window.
 *
 * 2. Composio redirect flow (has `connectedAccountId`/`connected_account_id` or `status=success`) —
 *    server-side redirect flow. Calls Core API to finalize the connection, then
 *    redirects to /dashboard/integrations with a `?connected=<provider>` param
 *    so the page can show a success toast. On error, redirects with `?connect_error=`.
 */
const _getHandler = withAuth(async (request: NextRequest, _ctx, params) => {
  const provider = params?.provider;
  if (!provider) {
    return new NextResponse(renderPopupFailure('Provider is required'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  // Composio sends camelCase; accept snake_case as fallback for older integrations
  const connectedAccountId =
    searchParams.get('connectedAccountId') ?? searchParams.get('connected_account_id');
  const status = searchParams.get('status');

  // 1. OAuth error from provider.
  // If the callback also carries Composio markers (connectedAccountId or status),
  // it's the tab-based redirect flow — redirect back to /dashboard/integrations
  // with a ?connect_error param so the toast handler can surface it.
  // Otherwise fall back to the classic popup failure HTML.
  if (error) {
    if (connectedAccountId || status) {
      const target = KNOWN_PROVIDER_IDS.has(provider)
        ? `/dashboard/integrations?connect_error=${encodeURIComponent(error)}`
        : '/dashboard/integrations';
      return NextResponse.redirect(new URL(target, request.url));
    }
    return new NextResponse(renderPopupFailure(`Authorization denied: ${error}`), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // 2. Classic OAuth code exchange — popup/postMessage flow
  if (code) {
    try {
      await getApiClient().storeOAuthToken(provider, { code, state });
      return new NextResponse(renderPopupSuccess(), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete authorization';
      return new NextResponse(renderPopupFailure(message), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  // 3. Composio server-side redirect flow
  if (connectedAccountId || status === 'success') {
    // Security: validate provider against known list before reflecting in redirect URL
    if (!KNOWN_PROVIDER_IDS.has(provider)) {
      return NextResponse.redirect(new URL('/dashboard/integrations', request.url));
    }

    try {
      await getApiClient().finalizeComposioConnection(provider, {
        connectedAccountId: connectedAccountId ?? undefined,
      });
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?connected=${encodeURIComponent(provider)}`, request.url),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete authorization';
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?connect_error=${encodeURIComponent(msg)}`, request.url),
      );
    }
  }

  // 4. Fallback — unrecognised callback shape
  return new NextResponse(renderPopupFailure('Missing authorization code'), {
    status: 400,
    headers: { 'Content-Type': 'text/html' },
  });
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _getHandler(request, { params: Promise.resolve(params) });
}

/**
 * Renders a minimal HTML page that posts a SUCCESS message to the opener window
 * (the dashboard) and closes itself. Used by the classic OAuth popup flow.
 */
function renderPopupSuccess(): string {
  const payload = JSON.stringify({ type: 'oauth-callback', success: true, error: null });
  return `<!DOCTYPE html>
<html>
<head><title>Authorization Complete</title></head>
<body>
  <p>Authorization successful. This window will close automatically.</p>
  <script>
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify(payload)}, window.location.origin);
    }
    window.close();
  </script>
</body>
</html>`;
}

/**
 * Renders a minimal HTML page that posts a FAILURE message to the opener window
 * and closes itself. Used by the classic OAuth popup flow.
 */
function renderPopupFailure(errorMessage: string): string {
  const payload = JSON.stringify({ type: 'oauth-callback', success: false, error: errorMessage });
  return `<!DOCTYPE html>
<html>
<head><title>Authorization Failed</title></head>
<body>
  <p>Authorization failed: ${errorMessage}</p>
  <script>
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify(payload)}, window.location.origin);
    }
    window.close();
  </script>
</body>
</html>`;
}
