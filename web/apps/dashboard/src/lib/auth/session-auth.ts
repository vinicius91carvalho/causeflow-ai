import { jwtVerify } from 'jose';

/**
 * Open-source local-runtime session auth (AC-046).
 *
 * Replaces the legacy hosted-auth `auth()` helper. The CauseFlow Core
 * API issues a short-lived JWT signed with the shared `JWT_SECRET`. This
 * module provides server-side helpers to verify the JWT, extract claims, and
 * produce a backend token for onward Core API calls.
 *
 * No outbound call to clerk.com is ever made.
 */

const SESSION_COOKIE = '__session';

/**
 * Return the shared JWT secret as a Uint8Array suitable for `jose`.
 * Throws if `JWT_SECRET` is not set, which is a fatal configuration error.
 */
export function getJwtSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      "JWT_SECRET is not configured. Set it in .env.local (must match the Core API's JWT_SECRET).",
    );
  }
  return new TextEncoder().encode(secret.trim());
}

/**
 * Claims decoded from the local JWT (issued by the CauseFlow Core API).
 *
 * Core's JWT payload shape (subject to change):
 *   { sub: string, email: string, name: string,
 *     tenantId: string, role: 'admin'|'member' }
 */
export interface SessionClaims {
  /** User id (Core user UUID, e.g. "usr_abc123") */
  sub?: string;
  email?: string;
  name?: string;
  /** Tenant / organization id */
  tenantId?: string;
  /** Snake_case variant used by Core API JWTs */
  tenant_id?: string;
  /** Role inside the tenant */
  role?: 'admin' | 'member';
  /** Legacy alias — Core JWT may use "orgId" instead of "tenantId" */
  orgId?: string;
  /** Legacy alias — Core JWT may use "orgRole" instead of "role" */
  orgRole?: 'admin' | 'member';
  /** OSS Core JWT uses a roles array instead of a single role claim */
  roles?: string[];
  [key: string]: unknown;
}

function resolveRole(claims: SessionClaims): 'admin' | 'member' {
  const direct = claims.role ?? claims.orgRole;
  if (direct === 'admin' || direct === 'member') return direct;
  const roles = claims.roles;
  if (Array.isArray(roles)) {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('member')) return 'member';
  }
  return 'member';
}

/**
 * Normalised auth context resolved from the JWT claims.
 * This is the shape consumed by `withAuth` and server component helpers.
 */
export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

/**
 * Verify the `__session` cookie value (the JWT issued by the Core API).
 * Returns the decoded claims, or `null` if the cookie is missing, invalid,
 * or the signature does not match `JWT_SECRET`.
 */
export async function verifySessionCookie(
  cookieValue: string | undefined,
): Promise<SessionClaims | null> {
  if (!cookieValue) return null;

  try {
    const secret = getJwtSecretBytes();
    const { payload } = await jwtVerify(cookieValue, secret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

/**
 * Verify the `__session` cookie from a Next.js request (or any object with
 * a `.cookies.get()` method). Returns the decoded claims or null.
 */
export async function getSessionFromRequest(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): Promise<SessionClaims | null> {
  const cookie = request.cookies.get(SESSION_COOKIE);
  return verifySessionCookie(cookie?.value);
}

/** Alias for the cookie name used across the dashboard */
export { SESSION_COOKIE };

/** Resolve a normalised AuthContext from raw SessionClaims. */
export function claimsToAuthContext(claims: SessionClaims): AuthContext {
  return {
    userId: claims.sub ?? String(claims.userId ?? ''),
    tenantId: claims.tenantId ?? claims.tenant_id ?? claims.orgId ?? String(claims.userId ?? ''),
    email: claims.email ?? '',
    name: claims.name ?? '',
    role: resolveRole(claims),
  };
}
