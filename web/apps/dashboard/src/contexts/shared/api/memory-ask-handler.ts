import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/memory/ask
 *
 * Ask a question to the memory intelligence system.
 * Accepts { question, context? } and returns the AI response.
 */
export const POST = withAuth(async (request: NextRequest) => {
  let body: { question?: string; context?: string };
  try {
    body = (await request.json()) as { question?: string; context?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const result = await getApiClient().askMemory({ question: body.question, context: body.context });
  return NextResponse.json(result);
});
