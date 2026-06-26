import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

/** Cookie name used for staging authentication. */
const STAGING_COOKIE_NAME = 'staging-authorized';

/** Max age for the staging auth cookie (7 days). */
const STAGING_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Set the staging auth cookie. Call this from a server action after validating
 * the staging password. The cookie format matches what `checkStagingAuth`
 * expects: base64-encoded `"staging-authorized:<password>"`.
 */
export async function setStagingAuthCookie(password: string): Promise<void> {
  const token = Buffer.from(`${STAGING_COOKIE_NAME}:${password}`).toString('base64');
  const cookieStore = await cookies();
  cookieStore.set(STAGING_COOKIE_NAME, token, {
    maxAge: STAGING_COOKIE_MAX_AGE,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
}

/**
 * Check cookie-based authentication for staging environment protection.
 *
 * Returns null if the request should pass through (not staging, no password
 * configured, request is for auth/static paths, or cookie is valid).
 * Returns a redirect to /staging-auth if the cookie is missing or invalid.
 *
 * Only activates when:
 *   - NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'
 *   - NEXT_PUBLIC_STAGING_PASSWORD is a non-empty string
 */
export function checkStagingAuth(request: NextRequest): NextResponse | null {
  const stage = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE;
  const stagingPassword = process.env.NEXT_PUBLIC_STAGING_PASSWORD;

  // Not staging or no password configured — pass through
  if (stage !== 'staging' || !stagingPassword) {
    return null;
  }

  const { pathname } = request.nextUrl;

  // Allow the login page, Next.js internals, API routes, and static assets
  // to pass through unconditionally to avoid redirect loops.
  if (
    pathname === '/staging-auth' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.[^/]+$/.test(pathname)
  ) {
    return null;
  }

  const cookieValue = request.cookies.get(STAGING_COOKIE_NAME)?.value;

  if (cookieValue) {
    try {
      const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8');
      // Expected format: "<STAGING_COOKIE_NAME>:<password>"
      const colonIndex = decoded.indexOf(':');
      const password = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : decoded;

      if (password === stagingPassword) {
        return null;
      }
    } catch {
      // Invalid base64 — fall through to redirect
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/staging-auth';
  return NextResponse.redirect(loginUrl);
}
