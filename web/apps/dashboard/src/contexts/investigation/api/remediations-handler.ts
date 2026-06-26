import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/remediations
 * List remediations for the authenticated user's tenant.
 *
 * Query params:
 *   - incidentId: required — the incident to list remediations for
 */
export const GET = withAuth(async (request: NextRequest, _ctx) => {
  const url = new URL(request.url);
  const incidentId = url.searchParams.get('incidentId');

  if (!incidentId) {
    return NextResponse.json({ error: 'incidentId query parameter is required' }, { status: 400 });
  }

  try {
    const client = getApiClient();
    const remediations = await client.listRemediations(incidentId);
    return NextResponse.json({ remediations });
  } catch (error) {
    console.error('Failed to list remediations:', error);
    return NextResponse.json({ error: 'Failed to load remediations' }, { status: 500 });
  }
});
