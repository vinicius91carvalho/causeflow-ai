import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';

/**
 * GET /api/integrations/sentry
 *
 * Returns the Sentry verification status for the tenant. Proxies to Core API
 * GET /v1/integrations/sentry. Never returns the Client Secret. The tenantId
 * is derived server-side from the Clerk JWT `org_id` claim by Core (W4).
 */
export async function handleGetSentryIntegration(_req: NextRequest): Promise<NextResponse> {
  try {
    const status = await getApiClient().getSentryIntegrationStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Sentry status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/integrations/sentry
 *
 * Saves the Sentry Internal Integration Client Secret. The dashboard never
 * holds the secret at rest — it forwards once to Core and never logs it.
 * Core extracts the tenantId from the Clerk JWT `org_id` (W4); never trust a
 * tenantId in the request body.
 *
 * Security:
 * - The error path never includes the raw `body` in any log/response.
 * - Validation rejects empty / non-string Client Secret values.
 */
export async function handleSaveSentryIntegration(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).clientSecret !== 'string'
  ) {
    return NextResponse.json({ error: 'clientSecret is required' }, { status: 400 });
  }

  const { clientSecret } = body as { clientSecret: string };

  if (!clientSecret.trim()) {
    return NextResponse.json({ error: 'clientSecret is required' }, { status: 400 });
  }

  try {
    const result = await getApiClient().saveSentryClientSecret(clientSecret);
    return NextResponse.json(result);
  } catch (err) {
    // Important: never include `body` or any part of clientSecret in error output.
    const message = err instanceof Error ? err.message : 'Failed to save Sentry Client Secret';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
