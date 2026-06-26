import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';

/** Lightweight schema — backend handles the real validation */
const testSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();

/**
 * POST /api/integrations/test
 * Test integration connection. Delegates to backend POST /v1/integrations/test-connection.
 * For OAuth integrations, backend just returns success (format check).
 * For AWS/cloudwatch, backend does a real STS AssumeRole test.
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    const { data, error } = await parseBody(request, testSchema);
    if (error) return error;

    try {
      const result = await getApiClient().testIntegrationConnection(data);
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      return NextResponse.json(
        { success: false, message, details: 'Connection test failed' },
        { status: 200 },
      );
    }
  },
  {
    adminOnly: true,
    rateLimit: { limit: 5, windowMs: 60 * 1000 },
  },
);
