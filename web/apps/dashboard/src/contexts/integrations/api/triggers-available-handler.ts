import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const GET = withAuth(async (_request, _ctx) => {
  const triggers = await getApiClient().listAvailableTriggers();
  return NextResponse.json({ triggers });
});
