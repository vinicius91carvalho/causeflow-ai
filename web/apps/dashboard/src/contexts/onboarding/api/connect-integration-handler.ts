import { type NextRequest, NextResponse } from 'next/server';
import { connectIntegrationSchema } from '@/contexts/integrations/infrastructure/api-schema';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';

/**
 * POST /api/onboarding/connect-integration
 * Connect an integration during onboarding. Delegates to the Core API.
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    const { data, error } = await parseBody(request, connectIntegrationSchema);
    if (error) return error;

    try {
      const result = await getApiClient().connectIntegration(data);
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect integration';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { adminOnly: true },
);
