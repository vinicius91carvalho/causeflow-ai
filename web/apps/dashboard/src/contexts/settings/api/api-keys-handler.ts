import { type NextRequest, NextResponse } from 'next/server';
import { createApiKeySchema } from '@/contexts/settings/infrastructure/api-schema';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/settings/api-keys
 * Returns the list of API keys for the authenticated tenant.
 * Requires authentication.
 */
export const GET = withAuth(async (_request: NextRequest, _ctx) => {
  const client = getApiClient();
  const result = await client.listApiKeys();
  return NextResponse.json(result);
});

/**
 * POST /api/settings/api-keys
 * Creates a new API key. Returns the plaintext key (shown once).
 * Requires admin role.
 */
export const POST = withAuth(
  async (request: NextRequest, _ctx) => {
    const { data, error } = await parseBody(request, createApiKeySchema);
    if (error) return error;

    const client = getApiClient();
    const created = await client.createApiKey({ name: data.name });
    return NextResponse.json(created, { status: 201 });
  },
  { adminOnly: true },
);

/**
 * DELETE /api/settings/api-keys?keyId=<id>
 * Revokes an existing API key.
 * Requires admin role.
 */
export const DELETE = withAuth(
  async (request: NextRequest, _ctx) => {
    const keyId = request.nextUrl.searchParams.get('keyId');
    if (!keyId) {
      return NextResponse.json({ error: 'Missing keyId query parameter.' }, { status: 400 });
    }

    const client = getApiClient();
    const result = await client.revokeApiKey(keyId);
    return NextResponse.json(result);
  },
  { adminOnly: true },
);
