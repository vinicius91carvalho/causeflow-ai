import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

const _handler = withAuth(
  async (_request: NextRequest, ctx, params) => {
    const targetUserId = params?.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Cannot remove self
    if (targetUserId === ctx.userId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the team.' },
        { status: 403 },
      );
    }

    const client = getApiClient();
    const result = await client.removeTeamMember(targetUserId);

    return NextResponse.json({ success: result.success, userId: targetUserId });
  },
  { adminOnly: true },
);

/**
 * DELETE /api/team/[userId]
 * Remove a team member (Admin only).
 * Cannot remove self. Returns 404 to avoid leaking cross-tenant info.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _handler(request, { params: Promise.resolve(params) });
}
