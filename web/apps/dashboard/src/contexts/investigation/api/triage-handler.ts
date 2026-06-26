import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/analyses/[id]/triage
 *
 * Triggers AI triage for the given analysis.
 */
const _postHandler = withAuth(async (_request: NextRequest, _ctx, params) => {
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
  }

  const result = await getApiClient().triggerTriage(id);
  return NextResponse.json(result);
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _postHandler(request, { params: Promise.resolve(params) });
}
