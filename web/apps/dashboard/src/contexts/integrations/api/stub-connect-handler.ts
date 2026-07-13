import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { CoreApiError } from '@/lib/api/http-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * POST /api/integrations/stub/connect
 *
 * OSS connector path (AC-055): proxies to Core `POST /v1/integrations/stub/connect`,
 * which registers the tenant against the Core-owned stub upstream / test-app.
 * Composio is not used. Admin only.
 */
export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const start = Date.now();
    let body: { baseUrl?: string; coreBaseUrl?: string } = {};
    try {
      const raw = await request.json().catch(() => ({}));
      if (raw && typeof raw === 'object') {
        body = raw as { baseUrl?: string; coreBaseUrl?: string };
      }
    } catch {
      body = {};
    }

    try {
      const result = await getApiClient().connectStubIntegration(body);
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
      dashLogger.error({ err, ...logPayload }, 'Stub connect failed');
      if (err instanceof CoreApiError && err.status >= 500) {
        Sentry.captureException(err, { extra: logPayload });
      }
      const message = err instanceof Error ? err.message : 'Failed to connect stub integration';
      const status = err instanceof CoreApiError ? err.status : 500;
      return NextResponse.json({ error: message }, { status });
    }
  },
  { adminOnly: true },
);
