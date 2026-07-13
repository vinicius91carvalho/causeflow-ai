import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { CoreApiError } from '@/lib/api/http-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * POST /api/integrations/stub/probe
 *
 * OSS Test Application probe path (AC-071 / AC-072): proxies to Core
 * `POST /v1/integrations/stub/probe`. When causeflow-test-app is stopped or
 * unreachable, returns `{ success: false, message }` with a clear unreachable
 * error — never a false healthy result.
 */
export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const start = Date.now();
    try {
      const result = await getApiClient().probeStubIntegration();
      return NextResponse.json({
        success: true,
        message: result.message,
        probeCount: result.probeCount,
        probedAt: result.probedAt,
      });
    } catch (err) {
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.warn({ err, ...logPayload }, 'Stub probe failed');
      if (err instanceof CoreApiError && err.status >= 500) {
        Sentry.captureException(err, { extra: logPayload });
      }
      const message = err instanceof Error ? err.message : 'Stub upstream probe failed';
      return NextResponse.json({ success: false, message }, { status: 200 });
    }
  },
  { adminOnly: true },
);
