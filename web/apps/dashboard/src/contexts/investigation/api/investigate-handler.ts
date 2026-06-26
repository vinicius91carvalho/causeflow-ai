import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/analyses/[id]/investigate
 *
 * Triggers an AI investigation for the given analysis.
 * If the body contains `{ abort: true }`, aborts the running investigation instead.
 */
const _postHandler = withAuth(async (request: NextRequest, _ctx, params) => {
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
  }

  let abort = false;
  try {
    const body = (await request.clone().json()) as { abort?: boolean };
    abort = body?.abort === true;
  } catch {
    // no body or invalid JSON — treat as a regular trigger
  }

  const api = getApiClient();
  const result = abort ? await api.abortInvestigation(id) : await api.triggerInvestigation(id);
  return NextResponse.json(result);
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _postHandler(request, { params: Promise.resolve(params) });
}
