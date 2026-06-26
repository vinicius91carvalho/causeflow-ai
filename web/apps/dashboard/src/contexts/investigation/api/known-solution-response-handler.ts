import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const POST = withAuth(async (request: NextRequest, _ctx, params) => {
  const id = params?.id as string;
  const body = await request.json();
  const result = await getApiClient().respondKnownSolution(id, body);
  return NextResponse.json(result);
});
