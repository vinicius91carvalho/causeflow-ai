/**
 * POST /api/onboarding/business-profile/resync
 *
 * Resync is not supported: the Core API's /memory/chat endpoint is
 * write-only and there is no stored profile record to re-send.
 * Users who need to update AI memory should re-submit via the form
 * at /onboarding/business-profile?edit=1.
 *
 * Requires MANAGE_SETTINGS (admin only).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';

export const POST = withAuth(
  async (_request: NextRequest, _ctx) => {
    return NextResponse.json(
      {
        error: 'Resync is not available. To update AI memory, re-submit the business profile form.',
      },
      { status: 404 },
    );
  },
  { adminOnly: true },
);
