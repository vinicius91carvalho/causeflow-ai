import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/memory/summary
 *
 * Returns a high-level summary of the memory knowledge base
 * for the current tenant.
 */
export const GET = withAuth(async (_request, _ctx) => {
  const summary = await getApiClient().getMemorySummary();
  return NextResponse.json(summary);
});
