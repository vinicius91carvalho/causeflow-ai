import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const GET = withAuth(async (_request, _ctx) => {
  try {
    const triggers = await getApiClient().listTriggers();
    return NextResponse.json({ triggers });
  } catch {
    return NextResponse.json({ triggers: [] });
  }
});

export const POST = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();
    try {
      const result = await getApiClient().createTrigger(body);
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create trigger';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { adminOnly: true },
);
