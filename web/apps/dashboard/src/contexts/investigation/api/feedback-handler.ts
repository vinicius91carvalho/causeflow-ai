import { type NextRequest, NextResponse } from 'next/server';
import { submitFeedbackSchema } from '@/contexts/investigation/infrastructure/api-schema';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/incidents/[id]/feedback
 * List feedback for a specific incident.
 */
export const GET = withAuth(async (_request: NextRequest, _ctx, params) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
  }

  try {
    const client = getApiClient();
    const result = await client.listFeedback(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to list feedback:', error);
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
  }
});

/**
 * POST /api/incidents/[id]/feedback
 * Submit feedback for a specific incident.
 */
export const POST = withAuth(async (request: NextRequest, _ctx, params) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = submitFeedbackSchema.safeParse({ ...(body as object), incidentId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
    const client = getApiClient();
    const item = await client.submitFeedback(parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : 'Failed to submit feedback';
    return NextResponse.json({ error: message }, { status });
  }
});
