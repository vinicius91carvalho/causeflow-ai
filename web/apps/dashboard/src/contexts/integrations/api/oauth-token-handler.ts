import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const POST = withAuth(
  async (request: NextRequest, _ctx, params) => {
    const provider = params?.provider as string;
    const body = await request.json();
    const result = await getApiClient().storeOAuthToken(provider, body);
    return NextResponse.json(result);
  },
  { adminOnly: true },
);
