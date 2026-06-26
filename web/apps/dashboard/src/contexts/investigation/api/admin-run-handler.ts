import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/admin/incidents/[id]/run
 *
 * Staff-only: stamp a reasoning mode on the incident and trigger the
 * investigation under that mode. Guarded twice:
 *   1. `withAuth({ staffOnly: true })` — only @causeflow.ai emails pass.
 *   2. Core API `requireStaff` middleware on
 *      `/v1/investigation/admin/:id/run` — server-side belt and
 *      suspenders so the route cannot be abused if someone bypasses
 *      the dashboard.
 */
const adminRunSchema = z.object({
  mode: z.enum(['orchestrator', 'hypothesis', 'debate']),
  shadowMode: z.enum(['orchestrator', 'hypothesis', 'debate']).optional(),
  suggestedAgents: z.array(z.string()).optional(),
});

const _postHandler = withAuth(
  async (request: NextRequest, _ctx, params) => {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 });
    }

    let parsed: z.infer<typeof adminRunSchema>;
    try {
      const body = (await request.json()) as unknown;
      parsed = adminRunSchema.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const api = getApiClient();
    const result = await api.adminRunInvestigation(id, parsed);
    return NextResponse.json(result);
  },
  { staffOnly: true },
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return _postHandler(request, { params: Promise.resolve(params) });
}
