import { type NextRequest, NextResponse } from 'next/server';
import { BILLING_DISABLED_MESSAGE } from '@/contexts/billing/application/billing-disabled';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/billing/subscription
 * OSS builds return 410 Gone — no commercial subscription or credits quota
 * payloads that would reintroduce quota UX (AC-074 / AC-076).
 */
export const GET = withAuth(async (_request: NextRequest, _ctx) => {
  return NextResponse.json({ error: BILLING_DISABLED_MESSAGE }, { status: 410 });
});
