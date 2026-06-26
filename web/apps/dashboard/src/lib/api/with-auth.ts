import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { logRequest } from '@/contexts/shared/lib/monitoring/request-logger';
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
 * Next.js 15 route context — params is a required Promise
 * For non-dynamic routes, Next.js passes an empty resolved Promise
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
    // Retrieve Clerk auth session
    const { userId, orgId, orgRole, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!orgId && !options.allowNoOrg) {
      return NextResponse.json(
        { error: 'Profile setup required. Please complete onboarding.' },
        { status: 403 },
      );
    }

    // Map Clerk org role to app role
    const role: 'admin' | 'member' = orgRole === 'org:admin' ? 'admin' : 'member';

    // Role guard — requiredRole takes precedence over adminOnly
    if (options.requiredRole !== undefined) {
      if (role !== options.requiredRole) {
        return NextResponse.json({ error: 'Insufficient role for this action.' }, { status: 403 });
      }
    } else if (options.adminOnly && role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    // Per-user rate limiting
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

    const email = ((sessionClaims as Record<string, unknown>)?.email as string) ?? '';
    const name = ((sessionClaims as Record<string, unknown>)?.name as string) ?? '';
    const isStaff = computeIsStaff(email);

    if (options.staffOnly && !isStaff) {
      return NextResponse.json({ error: 'Staff access required.' }, { status: 403 });
    }

    const authCtx: AuthContext = {
      userId,
      tenantId: orgId ?? '',
      email,
      name,
      role,
      profileComplete: true, // Clerk handles profile completion
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
          tenantId: orgId ?? '',
          duration,
        },
        `Unhandled error in ${request.method} ${url.pathname}`,
      );
      throw error;
    }
  };
}
