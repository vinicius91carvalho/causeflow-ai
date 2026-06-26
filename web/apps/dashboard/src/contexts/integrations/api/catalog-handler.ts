import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/integrations/catalog
 * Returns the full catalog of available integration providers from the backend.
 * Includes type (oauth/credential), category, description, and AWS setup info.
 */
export const GET = withAuth(async (_request: NextRequest) => {
  const catalog = await getApiClient().getIntegrationCatalog();
  return NextResponse.json(catalog);
});
