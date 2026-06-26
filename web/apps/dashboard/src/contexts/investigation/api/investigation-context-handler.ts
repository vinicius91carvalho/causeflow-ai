import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/analyses/[id]/context
 *
 * Adds additional context to an ongoing investigation.
 */
const _postHandler = withAuth(async (request: NextRequest, _ctx, params) => {
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: 'Analysis ID is required' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = await getApiClient().addInvestigationContext(id, body);
  return NextResponse.json(result);
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _postHandler(request, { params: Promise.resolve(params) });
}
