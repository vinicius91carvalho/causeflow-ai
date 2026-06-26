import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { changeRoleSchema } from '@/lib/api/schemas';
import { withAuth } from '@/lib/api/with-auth';

const _handler = withAuth(
  async (request: NextRequest, ctx, params) => {
    const targetUserId = params?.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent admin from demoting themselves (would cause lockout)
    if (targetUserId === ctx.userId) {
      return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 403 });
    }

    const { data, error: parseError } = await parseBody(request, changeRoleSchema);
    if (parseError) return parseError;

    const { role } = data;

    const client = getApiClient();
    const result = await client.changeTeamMemberRole(targetUserId, { role });

    return NextResponse.json({
      success: result.success,
      userId: targetUserId,
      role,
    });
  },
  { adminOnly: true },
);

/**
 * PATCH /api/team/[userId]/role
 * Change a team member's role (Admin only).
 *
 * Enforces tenant isolation — you can only change roles of users in your tenant.
 * An admin cannot demote themselves to prevent lockout.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _handler(request, { params: Promise.resolve(params) });
}
