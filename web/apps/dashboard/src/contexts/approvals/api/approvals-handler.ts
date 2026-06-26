import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/approvals
 * List pending approvals for the authenticated user's tenant.
 */
export const GET = withAuth(async (_request: NextRequest) => {
  try {
    const approvals = await getApiClient().listPendingApprovals();
    return NextResponse.json({ approvals });
  } catch (error) {
    console.error('Failed to list approvals:', error);
    return NextResponse.json({ error: 'Failed to load approvals' }, { status: 500 });
  }
});
