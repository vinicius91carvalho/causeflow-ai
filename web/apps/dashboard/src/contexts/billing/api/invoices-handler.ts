import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const GET = withAuth(
  async (request: NextRequest) => {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '10');
    const invoices = await getApiClient().getInvoices(limit);
    return NextResponse.json(invoices);
  },
  { adminOnly: true },
);
