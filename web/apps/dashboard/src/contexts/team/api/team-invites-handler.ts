import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/team/invites
 * List all pending invites for the authenticated user's tenant (Admin only).
 */
export const GET = withAuth(
  async (_request: NextRequest, _ctx) => {
    const client = getApiClient();
    const result = await client.listInvites();

    return NextResponse.json(result);
  },
  { adminOnly: true },
);
