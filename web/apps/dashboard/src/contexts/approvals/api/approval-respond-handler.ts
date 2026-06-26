import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';

const approvalRespondSchema = z.object({
  action: z.enum(['approve', 'reject']),
  respondedBy: z.string(),
});

/**
 * POST /api/approvals/[id]/respond
 * Respond to a pending approval.
 *
 * Body: { action: 'approve' | 'reject'; respondedBy: string }
 */
export const POST = withAuth(async (request: NextRequest, _ctx, params) => {
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: 'Missing approval ID' }, { status: 400 });
  }

  const { data, error } = await parseBody(request, approvalRespondSchema);
  if (error) return error;

  try {
    const result = await getApiClient().respondToApproval(id, data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to respond to approval:', error);
    return NextResponse.json({ error: 'Failed to respond to approval' }, { status: 500 });
  }
});
