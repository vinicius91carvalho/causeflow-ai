import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/incidents/[id]/hypotheses
 *
 * Returns every hypothesis attached to the incident. Empty array for
 * orchestrator-mode incidents (which never produce hypotheses) — the UI
 * treats "no hypotheses" as "render the legacy view" so this endpoint
 * is safe for every incident.
 */
const _getHandler = withAuth(async (_request: NextRequest, _ctx, params) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
  }
  const api = getApiClient();
  const result = await api.listHypotheses(id);
  return NextResponse.json(result);
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _getHandler(request, { params: Promise.resolve(params) });
}
