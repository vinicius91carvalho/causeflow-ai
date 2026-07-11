/**
 * Server-side auth helper for server components and API route handlers.
 *
 * Reads the `__session` cookie via `cookies()` from `next/headers` (or an
 * explicit request object) and returns a resolved AuthContext. This replaces
 * the legacy hosted-auth `auth()` helper.
 *
 * Usage (server component):
 * ```ts
 * import { getServerAuth } from '@/lib/auth/get-server-auth';
 *
 * const auth = await getServerAuth();  // reads from cookies()
 * // auth.userId, auth.tenantId, auth.role
 * ```
 *
 * Usage (API handler with plain request):
 * ```ts
 * import { getSessionFromRequest } from '@/lib/auth/session-auth';
 * ```
 */

import { cookies } from 'next/headers';
import {
  type AuthContext,
  claimsToAuthContext,
  SESSION_COOKIE,
  verifySessionCookie,
} from './session-auth';

/**
 * Read and verify the `__session` cookie from the current request's cookie
 * store (server components only — uses `cookies()` from `next/headers`).
 *
 * Returns an `AuthContext` with the user's identity, or `null` if the user
 * is not authenticated (no cookie, invalid JWT, or expired).
 */
export async function getServerAuth(): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;

    const claims = await verifySessionCookie(sessionCookie);
    if (!claims) return null;

    return claimsToAuthContext(claims);
  } catch {
    return null;
  }
}

/**
 * Extract userId from the server auth. Returns `null` if not authenticated.
 * Convenience wrapper for the common "just need the user/org id" pattern.
 */
export async function getServerUserId(): Promise<string | null> {
  const auth = await getServerAuth();
  return auth?.userId ?? null;
}

/**
 * Extract tenantId from the server auth. Returns `null` if not authenticated
 * or no org is selected. Convenience for the pattern:
 * ```ts
 * const { orgId } = await auth();
 * ```
 */
export async function getServerTenantId(): Promise<string | null> {
  const auth = await getServerAuth();
  return auth?.tenantId ?? null;
}
