import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

const _handler = withAuth(
  async (request: NextRequest, ctx, params) => {
    const start = Date.now();
    const type = params?.type;

    if (!type) {
      return NextResponse.json({ error: 'Missing integration type' }, { status: 400 });
    }

    try {
      // AWS uses credential-based disconnect, all others use Composio OAuth
      if (type === 'aws' || type === 'cloudwatch') {
        await getApiClient().disconnectCredential(type);
      } else {
        await getApiClient().revokeOAuthConnection(type);
      }
      return NextResponse.json({ success: true, type });
    } catch (error) {
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err: error, ...logPayload }, `Unhandled API handler error`);
      Sentry.captureException(error, { extra: logPayload });
      return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 });
    }
  },
  { adminOnly: true },
);

/**
 * DELETE /api/integrations/[type]
 * Disconnect an integration by revoking the OAuth token for the given provider.
 * Enforces tenant isolation via Core API.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _handler(request, { params: Promise.resolve(params) });
}
