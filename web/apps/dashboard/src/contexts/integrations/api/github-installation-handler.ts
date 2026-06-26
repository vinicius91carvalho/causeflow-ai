import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/github/installation
 *
 * Returns the current GitHub App installation status.
 */
export const GET = withAuth(async (_request, _ctx) => {
  const installation = await getApiClient().getGitHubInstallation();
  return NextResponse.json(installation);
});

/**
 * DELETE /api/github/installation
 *
 * Revokes the current GitHub App installation.
 */
export const DELETE = withAuth(async (_request, _ctx) => {
  const result = await getApiClient().revokeGitHubInstallation();
  return NextResponse.json(result);
});
