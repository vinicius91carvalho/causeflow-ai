import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const DELETE = withAuth(
  async (_request: NextRequest, _ctx, params) => {
    const id = params?.id as string;
    await getApiClient().deleteTrigger(id);
    return NextResponse.json({ success: true });
  },
  { adminOnly: true },
);
