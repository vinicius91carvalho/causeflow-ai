import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

const _handler = withAuth(
  async (_request: NextRequest, _ctx, params) => {
    const rawEmail = params?.email;

    if (!rawEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const email = decodeURIComponent(rawEmail);

    const client = getApiClient();
    const result = await client.revokeInvite(email);

    return NextResponse.json(result);
  },
  { adminOnly: true },
);

/**
 * DELETE /api/team/invites/[email]
 * Revoke (expire) a pending invite (Admin only).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ email: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _handler(request, { params: Promise.resolve(params) });
}
