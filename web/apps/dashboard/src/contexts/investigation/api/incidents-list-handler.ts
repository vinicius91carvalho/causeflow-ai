import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/incidents
 *
 * Lists incidents for the current tenant, with optional query param passthrough.
 * Proxies to Core API GET /v1/incidents with status and limit forwarded.
 *
 * Query params:
 *   - status: filter by incident status (e.g. "active", "open", "resolved")
 *   - limit: number of results (default 20, max 100)
 *   - cursor: pagination cursor
 */
export const GET = withAuth(async (request: NextRequest, _ctx) => {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const sort = url.searchParams.get('sort') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam), 100) : 20;

  const result = await getApiClient().listIncidents({ status, limit, cursor, sort });
  return NextResponse.json(result);
});
