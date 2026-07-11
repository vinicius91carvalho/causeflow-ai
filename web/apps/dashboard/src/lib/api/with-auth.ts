import { type NextRequest, NextResponse } from 'next/server';
import { logRequest } from '@/contexts/shared/lib/monitoring/request-logger';
import { SESSION_COOKIE, type SessionClaims, verifySessionCookie } from '@/lib/auth/session-auth';
import { logger as dashLogger } from '@/lib/logger';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * Authenticated request context passed to route handlers.
 */
export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  profileComplete: boolean;
  /** True when the authenticated email ends with a staff domain (causeflow.ai / simuser.ai). */
  isStaff: boolean;
}

const STAFF_EMAIL_DOMAINS = ['@causeflow.ai', '@simuser.ai'] as const;

function computeIsStaff(email: string): boolean {
  const lower = email.toLowerCase();
  return STAFF_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain));
}

/**
 * Next.js 15 route context — params is a required Promise.
 * For non-dynamic routes, Next.js passes an empty resolved Promise.
 */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

type RouteHandler = (
  request: NextRequest,
  ctx: AuthContext,
  params?: Record<string, string>,
) => Promise<NextResponse> | NextResponse;

interface WithAuthOptions {
  /** If true, only users with role=admin may access this route */
  adminOnly?: boolean;
  /**
   * Require the user to have a specific role.
   * Takes precedence over `adminOnly` if both are set.
   */
  requiredRole?: 'admin' | 'member';
  /** Rate limit config — defaults to 60 req/min per user */
  rateLimit?: { limit: number; windowMs: number };
  /**
   * If true, skip the orgId requirement. The handler will still receive
   * authentication context but `tenantId` may be an empty string.
   * Useful for routes like health checks that should work before org selection.
   */
  allowNoOrg?: boolean;
  /**
   * If true, only CauseFlow staff (email ending with @causeflow.ai) may
   * access this route. Used for internal-only experiments that must never
   * leak to tenant admins.
   */
  staffOnly?: boolean;
}

/**
 * Call the Core API's whoami endpoint to resolve user identity from the
 * local JWT session cookie.
 *
 * The Core API /v1/whoami response may be nested:
 *   { user: { id, email, name }, tenantId, role }
 * or flat:
 *   { id, email, name, tenantId, role }
 */
async function resolveWhoami(
  coreUrl: string,
  token: string,
): Promise<{
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}> {
  const res = await fetch(`${coreUrl}/v1/whoami`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Whoami failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    id?: string;
    userId?: string;
    email?: string;
    name?: string;
    tenantId?: string;
    orgId?: string;
    role?: string;
    orgRole?: string;
    // Nested user object (Core API /v1/whoami shape)
    user?: {
      id?: string;
      userId?: string;
      email?: string;
      name?: string;
    };
  };

  // Support both flat and nested response shapes
  const user = data.user ?? {};

  return {
    userId: user.id ?? user.userId ?? data.id ?? data.userId ?? '',
    tenantId: data.tenantId ?? data.orgId ?? '',
    email: user.email ?? data.email ?? '',
    name: user.name ?? data.name ?? '',
    role: (() => {
      const r = data.role ?? data.orgRole;
      if (r === 'admin') return 'admin' as const;
      const roles = (data as { roles?: string[] }).roles;
      if (Array.isArray(roles) && roles.includes('admin')) return 'admin' as const;
      return 'member' as const;
    })(),
  };
}

/**
 * Resolve claims from the JWT cookie as a fallback when the Core API is not
 * available (mock mode). This gives enough identity for mock-mode rendering.
 */
function claimsToAuth(claims: SessionClaims): {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
} {
  return {
    userId: (claims.sub as string) ?? (claims.userId as string) ?? '',
    tenantId:
      (claims.tenantId as string) ?? (claims.tenant_id as string) ?? (claims.orgId as string) ?? '',
    email: (claims.email as string) ?? '',
    name: (claims.name as string) ?? '',
    role: (() => {
      const direct = claims.role ?? claims.orgRole;
      if (direct === 'admin' || direct === 'member') return direct;
      const roles = claims.roles;
      if (Array.isArray(roles)) {
        if (roles.includes('admin')) return 'admin';
        if (roles.includes('member')) return 'member';
      }
      return 'member';
    })(),
  };
}

function getCoreUrl(): string | null {
  const url = process.env.CORE_API_URL;
  return url && url.trim() !== '' ? url : null;
}

/**
 * Higher-order function that wraps an API route handler with:
 * 1. Authentication check (401 if no session)
 * 2. tenantId validation (403 if not set — means onboarding incomplete)
 * 3. Optional admin-only guard (403 if role !== admin)
 * 4. Per-user rate limiting
 *
 * The returned function is typed to satisfy Next.js 15's RouteContext requirement.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, ctx) => {
 *   return NextResponse.json({ tenantId: ctx.tenantId });
 * });
 *
 * // Dynamic route — params are resolved
 * export const DELETE = withAuth(async (req, ctx, params) => {
 *   const id = params?.id;
 * });
 * ```
 */
export function withAuth(handler: RouteHandler, options: WithAuthOptions = {}) {
  // Return type uses RouteContext (non-optional) to satisfy Next.js 15 type checking
  return async function wrappedHandler(
    request: NextRequest,
    routeContext: RouteContext,
  ): Promise<NextResponse> {
    // 1. Read the __session cookie from the request
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // 2. Resolve user identity from the Core API (whoami) or fall back to JWT claims
    const coreUrl = getCoreUrl();
    let userId: string;
    let tenantId: string;
    let email: string;
    let name: string;
    let role: 'admin' | 'member';

    if (coreUrl) {
      try {
        const whoami = await resolveWhoami(coreUrl, sessionCookie);
        userId = whoami.userId;
        tenantId = whoami.tenantId;
        email = whoami.email;
        name = whoami.name;
        role = whoami.role;
      } catch {
        // If whoami fails, try to decode the JWT locally as a best-effort fallback
        const claims = await verifySessionCookie(sessionCookie);
        if (!claims) {
          return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
        }
        const local = claimsToAuth(claims);
        userId = local.userId;
        tenantId = local.tenantId;
        email = local.email;
        name = local.name;
        role = local.role;
      }
    } else {
      // No Core API configured — try to decode from JWT claims
      const claims = await verifySessionCookie(sessionCookie);
      if (!claims) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      }
      const local = claimsToAuth(claims);
      userId = local.userId;
      tenantId = local.tenantId;
      email = local.email;
      name = local.name;
      role = local.role;
    }

    // 3. Tenant validation
    if (!tenantId && !options.allowNoOrg) {
      return NextResponse.json(
        { error: 'Profile setup required. Please complete onboarding.' },
        { status: 403 },
      );
    }

    // 4. Role guard — requiredRole takes precedence over adminOnly
    if (options.requiredRole !== undefined) {
      if (role !== options.requiredRole) {
        return NextResponse.json({ error: 'Insufficient role for this action.' }, { status: 403 });
      }
    } else if (options.adminOnly && role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    // 5. Per-user rate limiting
    const rateLimitConfig = options.rateLimit ?? { limit: 60, windowMs: 60 * 1000 };
    const ip = getClientIp(request);
    const rateLimitKey = `api:${userId}:${ip}:${new URL(request.url).pathname}`;
    const limitResult = rateLimit(rateLimitKey, rateLimitConfig);

    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((limitResult.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    const isStaff = computeIsStaff(email);

    if (options.staffOnly && !isStaff) {
      return NextResponse.json({ error: 'Staff access required.' }, { status: 403 });
    }

    const authCtx: AuthContext = {
      userId,
      tenantId,
      email,
      name,
      role,
      profileComplete: true,
      isStaff,
    };

    // Resolve params Promise (Next.js 15 async params)
    const params = routeContext?.params ? await routeContext.params : undefined;

    const start = Date.now();
    try {
      const response = await handler(request, authCtx, params);
      const duration = Date.now() - start;
      logRequest(request, response.status, duration, {
        userId: authCtx.userId,
        tenantId: authCtx.tenantId,
        role: authCtx.role,
      });
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      const url = new URL(request.url);
      dashLogger.error(
        {
          err: error,
          method: request.method,
          path: url.pathname,
          userId,
          tenantId,
          duration,
        },
        `Unhandled error in ${request.method} ${url.pathname}`,
      );
      throw error;
    }
  };
}
