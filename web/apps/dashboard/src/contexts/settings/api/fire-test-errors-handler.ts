import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/api/get-backend-token';
import { withAuth } from '@/lib/api/with-auth';

/**
 * AD-8: BFF proxy for fire-test-errors.
 *
 * Forwards POST /admin/fire-test-errors to the Core API with the
 * Clerk session as a Bearer token. Passes through the response status
 * and body unchanged — the caller is responsible for interpreting
 * HTTP 500 + { error: 'TestErrorFired', traceId } as a success signal.
 *
 * W4 invariant: tenantId is NEVER included in the request body or query
 * string. The Core API extracts it from the Clerk JWT org_id claim.
 */
export const POST = withAuth(async (_request: NextRequest) => {
  const coreApiUrl = process.env.CORE_API_URL;
  if (!coreApiUrl) {
    return NextResponse.json({ error: 'CORE_API_URL is not configured' }, { status: 502 });
  }

  const token = await getBackendToken();

  const upstream = await fetch(`${coreApiUrl}/v1/admin/fire-test-errors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const rawBody = await upstream.text();

  // AD-8: pass upstream headers through unchanged (preserves traceparent, x-request-id, etc.)
  // Ensure Content-Type is always application/json even if upstream omits it.
  const upstreamHeaders = Object.fromEntries(upstream.headers.entries());
  const responseHeaders: Record<string, string> = {
    ...upstreamHeaders,
    'Content-Type': upstreamHeaders['content-type'] ?? 'application/json',
  };

  return new NextResponse(rawBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
});
