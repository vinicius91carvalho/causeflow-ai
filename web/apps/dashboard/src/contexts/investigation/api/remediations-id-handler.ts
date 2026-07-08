import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Remediation } from '@/contexts/investigation/domain/types';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

const remediationActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'execute']),
  reason: z.string().optional(),
});

/**
 * GET /api/remediations/[id]
 * Get a single remediation by ID.
 */
const _getHandler = withAuth(async (request: NextRequest, ctx, params) => {
  const start = Date.now();
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: 'Remediation ID is required' }, { status: 400 });
  }

  try {
    const client = getApiClient();
    const remediation = await client.getRemediation(id);
    return NextResponse.json({ remediation });
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('404') || message.includes('not found')) {
      return NextResponse.json({ error: 'Remediation not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load remediation' }, { status: 500 });
  }
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _getHandler(request, { params: Promise.resolve(params) });
}

/**
 * POST /api/remediations/[id]
 * Perform an action on a remediation.
 *
 * Body:
 *   - action: 'approve' | 'reject' | 'execute'
 *   - reason: string (optional, used for 'reject')
 */
const _postHandler = withAuth(async (request: NextRequest, ctx, params) => {
  const start = Date.now();
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: 'Remediation ID is required' }, { status: 400 });
  }

  const { data, error } = await parseBody(request, remediationActionSchema);
  if (error) return error;

  const { action, reason } = data;

  try {
    const client = getApiClient();
    let remediation: Remediation | undefined;

    if (action === 'approve') {
      remediation = await client.approveRemediation(id);
    } else if (action === 'reject') {
      remediation = await client.rejectRemediation(id, reason);
    } else if (action === 'execute') {
      remediation = await client.executeRemediation(id);
    }

    return NextResponse.json({ remediation });
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('404') || message.includes('not found')) {
      return NextResponse.json({ error: 'Remediation not found' }, { status: 404 });
    }
    if (message.includes('409') || message.includes('conflict')) {
      return NextResponse.json(
        { error: `Cannot ${action} remediation in its current state` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: `Failed to ${action} remediation` }, { status: 500 });
  }
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _postHandler(request, { params: Promise.resolve(params) });
}
