import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { inviteTeamMemberSchema } from '@/lib/api/schemas';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/team/invite
 * Invite a new team member by email (Admin only).
 *
 * Creates an invite record. The backend handles duplicate checking
 * and triggers the invitation email.
 */
export const POST = withAuth(
  async (request: NextRequest, _ctx) => {
    const { data, error } = await parseBody(request, inviteTeamMemberSchema);
    if (error) return error;

    const { email, role } = data;

    const client = getApiClient();
    const result = await client.createInvite({ email, role });

    return NextResponse.json(result, { status: 201 });
  },
  { adminOnly: true },
);
