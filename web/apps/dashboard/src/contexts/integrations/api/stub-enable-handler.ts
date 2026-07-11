import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * POST /api/integrations/stub/enable
 *
 * OSS additional connector path (AC-058): proxies to Core
 * `POST /v1/integrations/stub/enable`, which persists a second IntegrationRecord
 * (e.g. datadog) linked to the connected test application. Composio is not used.
 * Admin only.
 */
export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const start = Date.now();
    let body: { provider?: string } = {};
    try {
      const raw = await request.json().catch(() => ({}));
      if (raw && typeof raw === 'object') {
        body = raw as { provider?: string };
      }
    } catch {
      body = {};
    }

    const provider = typeof body.provider === 'string' ? body.provider.trim() : '';
    if (!provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    try {
      const result = await getApiClient().enableStubConnector({ provider });
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err, ...logPayload }, 'Stub enable failed');
      Sentry.captureException(err, { extra: logPayload });
      const message = err instanceof Error ? err.message : 'Failed to enable stub connector';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { adminOnly: true },
);
