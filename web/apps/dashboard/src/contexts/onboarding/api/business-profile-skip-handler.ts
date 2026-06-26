/**
 * POST /api/onboarding/business-profile/skip
 *
 * Records that the user chose to skip the business profile step.
 * No data is persisted (there is no read endpoint on the Core API memory
 * system), so this is a lightweight acknowledgment that redirects the
 * caller.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';

export const POST = withAuth(async (_request: NextRequest, _ctx) => {
  return NextResponse.json({ skippedAt: new Date().toISOString() });
});
