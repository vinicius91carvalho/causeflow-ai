/**
 * GET /api/onboarding/business-profile/schema
 *
 * Returns the active business profile form schema (both locales inline).
 * The client resolves LocalizedString fields at render time.
 */

import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { getActiveSchema } from '@/contexts/onboarding/infrastructure/business-profile-schemas/registry';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

export const GET = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  try {
    const schema = getActiveSchema();
    return NextResponse.json({ schema });
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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to load schema: ${msg}` }, { status: 500 });
  }
});
