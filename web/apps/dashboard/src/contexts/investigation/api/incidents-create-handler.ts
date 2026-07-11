import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeCredit } from '@/contexts/billing/application/credits-ledger';
import { getApiClient } from '@/lib/api/get-api-client';
import { CoreApiError } from '@/lib/api/http-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

function statusForError(err: unknown): number {
  if (err instanceof CoreApiError) return err.status;
  const msg = err instanceof Error ? err.message : String(err);
  if (/forbidden/i.test(msg)) return 403;
  if (/not.?found/i.test(msg)) return 404;
  if (/unauthori[sz]ed/i.test(msg)) return 401;
  if (/rate.?limit|too.?many/i.test(msg)) return 429;
  return 500;
}

const createIncidentSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  investigationMode: z.enum(['orchestrator', 'hypothesis', 'debate']).optional(),
});

/**
 * POST /api/incidents
 * Create a new incident/analysis. Enforces the local free-plan credits ledger
 * before proxying to Core POST /v1/incidents.
 */
export const POST = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  const { data, error } = await parseBody(request, createIncidentSchema);
  if (error) return error;

  const forwarded = ctx.isStaff ? data : { ...data, investigationMode: undefined };
  const client = getApiClient();

  const sub = (await client.getSubscription()) as {
    plan?: string;
    status?: string;
    investigationsLimit?: number;
    investigationsUsed?: number;
    currentPeriodEnd?: string | null;
    renewDate?: string | null;
  };

  const creditResult = consumeCredit(ctx.tenantId, sub);
  if (!creditResult.ok) {
    return NextResponse.json({ code: creditResult.code }, { status: 402 });
  }

  try {
    const result = await client.createIncident(forwarded);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const httpStatus = statusForError(err);
    if (httpStatus >= 500) {
      const logPath = new URL(request.url).pathname;
      const logPayload = {
        method: request.method,
        path: logPath,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        duration: Date.now() - start,
      };
      dashLogger.error({ err, ...logPayload }, 'Unhandled API handler error');
      Sentry.captureException(err, { extra: logPayload });
    }
    const msg = err instanceof Error ? err.message : 'Failed to create incident';
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }
});
