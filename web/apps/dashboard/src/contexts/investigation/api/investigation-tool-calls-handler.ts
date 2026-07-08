import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/investigation/[id]/tool-calls/[toolCallId]
 * Fetch the raw tool call record (input + output) behind a cited evidence.
 */
const _getHandler = withAuth(async (_request: NextRequest, _ctx, params) => {
  const id = params?.id;
  const toolCallId = params?.toolCallId;
  if (!id || !toolCallId) {
    return NextResponse.json(
      { error: 'Incident ID and tool call ID are required' },
      { status: 400 },
    );
  }

  try {
    const client = getApiClient();
    const record = await client.getToolCall(id, toolCallId);
    return NextResponse.json(record);
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json({ error: 'Failed to load tool call' }, { status });
  }
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; toolCallId: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _getHandler(request, { params: Promise.resolve(params) });
}
