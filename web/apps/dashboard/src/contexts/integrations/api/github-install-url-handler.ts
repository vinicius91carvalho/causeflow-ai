import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/github/install-url
 *
 * Returns the GitHub App installation URL.
 * Constructs the URL from the GITHUB_APP_SLUG environment variable.
 */
export const GET = withAuth(async (_request, _ctx) => {
  const slug = process.env.GITHUB_APP_SLUG;

  if (!slug) {
    return NextResponse.json({ error: 'GitHub App is not configured' }, { status: 503 });
  }

  const url = `https://github.com/apps/${slug}/installations/new`;
  return NextResponse.json({ url });
});
