import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/team
 * List all team members for the authenticated user's tenant.
 *
 * Query params:
 *   - cursor: pagination cursor from previous response
 */
export const GET = withAuth(async (request: NextRequest, _ctx) => {
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') ?? undefined;

  const client = getApiClient();
  const result = await client.listTeamMembers({ cursor });

  return NextResponse.json({
    members: result.members,
    pagination: result.pagination,
  });
});
