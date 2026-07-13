import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { billingDisabledResponse } from '@/contexts/billing/application/billing-disabled';
import { ossBillingGoneResponse } from '@/contexts/billing/application/oss-billing-gone';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    const ossGone = ossBillingGoneResponse();
    if (ossGone) return ossGone;

    const start = Date.now();
    let body: { packType: string; quantity: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { packType, quantity } = body;

    if (packType !== 'investigations' && packType !== 'events') {
      return NextResponse.json(
        { error: 'Invalid packType. Must be "investigations" or "events".' },
        { status: 400 },
      );
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: 'Invalid quantity. Must be a positive number.' },
        { status: 400 },
      );
    }

    try {
      const result = await getApiClient().purchaseQuotaPack({ packType, quantity });
      return NextResponse.json(result);
    } catch (err) {
      const disabled = billingDisabledResponse(err);
      if (disabled) {
        return NextResponse.json({ error: disabled.error }, { status: disabled.status });
      }
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err: err, ...logPayload }, `Unhandled API handler error`);
      Sentry.captureException(err, { extra: logPayload });
      return NextResponse.json({ error: 'Failed to purchase quota pack' }, { status: 500 });
    }
  },
  { adminOnly: true },
);
