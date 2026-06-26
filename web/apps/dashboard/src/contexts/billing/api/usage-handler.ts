import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/billing/usage
 *
 * Returns usage history for the current tenant.
 * Proxies to Core API GET /v1/billing/usage.
 *
 * Used by the billing dashboard to show consumption over time.
 */
export const GET = withAuth(async (_request, _ctx) => {
  const raw = (await getApiClient().getUsageHistory()) as unknown;
  // Core API returns `{ account, records }`. The dashboard section consumes
  // `{ items, cursor }`. Normalize so the front-end sees a stable shape.
  const obj = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as {
    records?: unknown[];
    items?: unknown[];
    cursor?: string | null;
    account?: unknown;
  };
  const items = Array.isArray(obj.items)
    ? obj.items
    : Array.isArray(obj.records)
      ? obj.records
      : [];
  return NextResponse.json({ items, cursor: obj.cursor ?? null, account: obj.account ?? null });
});
