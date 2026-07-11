import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * GET /api/integrations
 * List all integrations for the authenticated user's tenant.
 * Delegates to the Core API via getOAuthStatus().
 *
 * Response shape contract: { integrations: ApiIntegration[] }.
 * Consumers must extract `.integrations`; raw array shape is deprecated and only returned
 * if the upstream Core API returns an array directly (legacy back-compat).
 *
 * Normalizes Core OSS IntegrationSummary (`displayName`, no `type`) into the
 * dashboard card shape (`name`, `type`) so stub-upstream connected state renders.
 */
export const GET = withAuth(async (_request: NextRequest) => {
  const status = await getApiClient().getOAuthStatus();
  const raw = Array.isArray(status)
    ? status
    : ((status as { integrations?: unknown[] })?.integrations ?? []);
  const integrations = (Array.isArray(raw) ? raw : []).map((item) => {
    const row = item as Record<string, unknown>;
    const provider = String(row.provider ?? row.type ?? '');
    return {
      ...row,
      type: String(row.type ?? provider),
      provider,
      name: String(row.name ?? row.displayName ?? provider),
      status: String(row.status ?? 'disconnected'),
      createdAt: String(row.createdAt ?? ''),
    };
  });
  return NextResponse.json({ integrations });
});

/**
 * POST /api/integrations
 * Connect a credential-based integration (AWS only).
 * All other integrations use Composio OAuth via /api/integrations/oauth/[provider]/authorize.
 * Admin only.
 */
export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const start = Date.now();
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const provider = (body.provider as string) || (body.type as string);
    if (!provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    try {
      const { provider: _, type: __, ...credentials } = body;
      const result = await getApiClient().connectCredential(provider, credentials);
      return NextResponse.json(result);
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
      const message = err instanceof Error ? err.message : 'Failed to connect integration';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { adminOnly: true },
);
