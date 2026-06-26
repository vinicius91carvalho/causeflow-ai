import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/approvals/pending
 *
 * Lists pending approvals for the current tenant.
 * Proxies to Core API POST /v1/notifications/approvals/pending.
 *
 * Used by the ApprovalsPanel on the dashboard.
 */
export const GET = withAuth(async (_request, _ctx) => {
  const result = (await getApiClient().listPendingApprovals()) as unknown;
  // Core API returns `{ items: Approval[] }`; legacy callers may have returned a raw array.
  // Normalize to a flat array so the dashboard section can `.map()` safely.
  const approvals = Array.isArray(result)
    ? result
    : Array.isArray((result as { items?: unknown[] })?.items)
      ? (result as { items: unknown[] }).items
      : [];
  return NextResponse.json(approvals);
});
