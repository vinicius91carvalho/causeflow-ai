import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { INCIDENT_STATUSES } from '@/contexts/investigation/domain/types';
import { getApiClient } from '@/lib/api/get-api-client';
import { CoreApiError } from '@/lib/api/http-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * Map well-known Core API error messages to HTTP status codes when the
 * upstream client doesn't surface them as a CoreApiError. Keeps a single
 * place to translate semantic errors into BFF responses.
 */
function statusForError(err: unknown): number {
  if (err instanceof CoreApiError) return err.status;
  const msg = err instanceof Error ? err.message : String(err);
  if (/forbidden/i.test(msg)) return 403;
  if (/not.?found/i.test(msg)) return 404;
  if (/unauthori[sz]ed/i.test(msg)) return 401;
  if (/rate.?limit|too.?many/i.test(msg)) return 429;
  return 500;
}

/**
 * GET /api/analyses
 * List incidents for the authenticated user's tenant (paginated, newest first).
 *
 * Query params:
 *   - cursor: pagination cursor from previous response
 *   - status: filter by status (open|triaging|investigating|awaiting_approval|remediating|resolved|closed)
 *   - limit: number of results (default 20, max 100)
 */
export const GET = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Number(limitParam) || 20, 100);

  if (status && !INCIDENT_STATUSES.includes(status as (typeof INCIDENT_STATUSES)[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${INCIDENT_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const client = getApiClient();
    const result = await client.listIncidents({
      status,
      limit,
      cursor,
      sort: 'desc',
    });

    return NextResponse.json({
      incidents: result.items,
      pagination: {
        cursor: result.cursor,
        hasMore: !!result.cursor,
      },
    });
  } catch (error) {
    const httpStatus = statusForError(error);
    if (httpStatus >= 500) {
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
    }
    const msg = error instanceof Error ? error.message : 'Failed to load incidents';
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }
});

const createIncidentSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  /**
   * Staff-only. The BFF forwards it as-is; the Core API route silently
   * drops the field for non-staff callers (see staff.middleware.ts +
   * incident.routes.ts in the core repo), so tenants submitting this
   * via DevTools would see no effect.
   */
  investigationMode: z.enum(['orchestrator', 'hypothesis', 'debate']).optional(),
});

/**
 * POST /api/analyses
 * Create a new incident and trigger investigation.
 * Delegates to backend POST /v1/incidents/chat.
 */
export const POST = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  const { data, error } = await parseBody(request, createIncidentSchema);
  if (error) return error;

  // Frontend-side belt to the backend suspenders: strip the mode field
  // unless the caller is staff, so even a misbehaving client can't POP
  // the experimental modes to the upstream API.
  const forwarded = ctx.isStaff ? data : { ...data, investigationMode: undefined };

  try {
    const client = getApiClient();
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
      dashLogger.error({ err, ...logPayload }, `Unhandled API handler error`);
      Sentry.captureException(err, { extra: logPayload });
    }
    const msg = err instanceof Error ? err.message : 'Failed to create incident';
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }
});
