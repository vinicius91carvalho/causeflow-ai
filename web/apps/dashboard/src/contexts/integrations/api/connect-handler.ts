import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * POST /api/integrations/connect
 *
 * Proxies OAuth connect to Core `POST /v1/integrations/connect`.
 * In the OSS runtime (AC-051), Core's stub returns 200 with deterministic empty
 * data when Composio is absent — never call composio.dev from the browser.
 */
export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const start = Date.now();
    let body: { provider?: string; redirectUrl?: string } = {};
    try {
      const raw = await request.json().catch(() => ({}));
      if (raw && typeof raw === 'object') {
        body = raw as { provider?: string; redirectUrl?: string };
      }
    } catch {
      body = {};
    }

    const provider = body.provider;
    if (!provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const redirectUrl = body.redirectUrl ?? `${origin}/dashboard/integrations`;

    try {
      const result = await getApiClient().initiateOAuthConnect(provider, redirectUrl);
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect integration';
      // OSS Core stub: Composio is intentionally unset — surface 200 empty data.
      if (isOssRuntime() && /composio/i.test(message)) {
        return NextResponse.json({}, { status: 200 });
      }

      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err, ...logPayload }, 'Integration connect failed');
      Sentry.captureException(err, { extra: logPayload });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { adminOnly: true },
);
