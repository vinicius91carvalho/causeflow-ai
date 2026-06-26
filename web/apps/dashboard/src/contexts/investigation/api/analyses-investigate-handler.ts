import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const POST = withAuth(async (_request: NextRequest, _ctx, params) => {
  const id = params?.id as string;
  const result = await getApiClient().triggerInvestigation(id);
  return NextResponse.json(result);
});
