import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Open-source local-runtime middleware (AC-046).
 *
 * Replaces the Clerk `clerkMiddleware()`. Auth is a local short-lived JWT
 * issued by the CauseFlow Core API and stored in an `__session` httpOnly
 * cookie (see `/api/auth/login`). This middleware decodes the JWT payload
 * to check validity and expiration (signature is verified server-side by
 * `withAuth` via the Core's `whoami` on each API call). No outbound call
 * to clerk.com / stripe.com / amazonaws.com / sentry.io / sst. is made at
 * boot or per-request here.
 *
 * NOTE: Full JWT signature verification is intentionally deferred to
 * `withAuth` because the middleware runs in Next.js Edge Runtime, which
 * does not support `jose`'s compression APIs. The middleware only needs
 * to check cookie existence and basic validity for redirect decisions.
 */

const intlMiddleware = createMiddleware(routing);

const SUPPORTED_LOCALES = ['en', 'pt-br'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const COOKIE_NAME = 'NEXT_LOCALE';
const SESSION_COOKIE = '__session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Decode the payload of a JWT without verifying the signature.
 * Returns null if the JWT is malformed or expired (based on the `exp` claim).
 * Safe for Edge Runtime — no external crypto library needed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    if (!payload) return null;

    // Standard base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const json = JSON.parse(decoded) as Record<string, unknown>;

    // Check expiration
    if (json.exp && typeof json.exp === 'number') {
      if (Date.now() >= json.exp * 1000) return null;
    }

    return json;
  } catch {
    return null;
  }
}

// Public routes — mirror the previous Clerk `isPublicRoute` matcher so
// AC-019/AC-020 behavior is preserved.
const PUBLIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/api\/health/,
  /^\/api\/ingestion\/webhook$/,
  /^\/auth\/?(.*)$/,
  /^\/(en|pt-br)\/auth\/?(.*)$/,
  /^\/accept-invitation/,
  /^\/(en|pt-br)\/accept-invitation/,
  /^\/beta-waitlist/,
  /^\/(en|pt-br)\/beta-waitlist/,
  /^\/waitlist/,
  /^\/(en|pt-br)\/waitlist/,
  /^\/create-organization/,
  /^\/(en|pt-br)\/create-organization/,
  /^\/$/,
  /^\/(en|pt-br)\/?$/,
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((re) => re.test(pathname));
}

function hasOrganization(payload: Record<string, unknown>): boolean {
  const tenantId = payload.tenantId ?? payload.tenant_id ?? payload.orgId;
  return typeof tenantId === 'string' && tenantId.trim() !== '';
}

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((entry) => {
      const [tag = '', q = '1.0'] = entry.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? Number.parseFloat(q) : 1.0 };
    })
    .sort((a, b) => b.q - a.q)
    .map(({ tag }) => tag);
}

function matchLocale(tags: string[]): SupportedLocale | null {
  for (const tag of tags) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
      return tag as SupportedLocale;
    }
    const prefix = tag.split('-')[0];
    const prefixMatch = SUPPORTED_LOCALES.find(
      (locale) => locale.startsWith(`${prefix}-`) || locale === prefix,
    );
    if (prefixMatch) return prefixMatch;
  }
  return null;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Preserve the browser-facing host on redirects. `nextUrl.clone()` can
  // emit `localhost` even when the client hit `127.0.0.1` (or vice versa),
  // which drops `__session` cookies scoped to the other host and causes
  // ERR_TOO_MANY_REDIRECTS in OSS Playwright (AC-054/AC-055).
  const redirectTo = (path: string, search?: Record<string, string>) => {
    const host = request.headers.get('host') ?? request.nextUrl.host;
    const protocol = request.nextUrl.protocol || 'http:';
    const url = new URL(`${protocol}//${host}${path}`);
    if (search) {
      for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);
    }
    return NextResponse.redirect(url);
  };

  // API routes — skip i18n entirely. Protected API routes are guarded by
  // `withAuth` (which reads the __session cookie + Core whoami), not here.
  if (pathname.startsWith('/api/')) {
    return;
  }

  // Honor NEXT_LOCALE cookie for non-prefixed paths (mirrors previous behavior).
  {
    const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
    const hasLocalePrefix = SUPPORTED_LOCALES.some(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
    );
    if (!hasLocalePrefix && isSupportedLocale(cookieLocale) && cookieLocale !== 'en') {
      return redirectTo(`/${cookieLocale}${pathname === '/' ? '' : pathname}`);
    }
  }

  // Match auth-handlers: Secure only on real HTTPS. OSS compose runs the
  // production build over plain HTTP; Secure cookies break Playwright's
  // APIRequestContext on http:// (AC-061 Goal Review defect).
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const isHttps =
    forwardedProto === 'https' ||
    (forwardedProto !== 'http' && request.nextUrl.protocol === 'https:');
  const cookieOptions = {
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    path: '/',
    ...(isHttps ? { secure: true } : {}),
  };

  // Public routes — no auth required; run i18n middleware.
  if (isPublicRoute(pathname)) {
    return intlMiddleware(request);
  }

  // Protect all non-public routes: require the local __session cookie.
  // The JWT is decoded (payload only — no signature verification in the Edge
  // Runtime) to check expiration. Full verification happens server-side in
  // `withAuth` via the Core's `whoami` endpoint.
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return redirectTo('/auth/sign-in', { redirect_url: pathname });
  }

  // Decode the JWT payload (no signature verification in Edge Runtime).
  const payload = decodeJwtPayload(sessionCookie);
  if (!payload) {
    // Invalid or expired JWT — clear the cookie and redirect.
    const expiredResponse = redirectTo('/auth/sign-in', { redirect_url: pathname });
    expiredResponse.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });
    return expiredResponse;
  }

  // Authenticated but no tenant/org — send to create-organization (AC-020).
  if (!hasOrganization(payload)) {
    return redirectTo('/create-organization');
  }

  // Authenticated with org — locale prefix is applied via next.config `rewrites`
  // (internal). Do NOT NextResponse.rewrite() to an absolute /en/... URL here:
  // Next treats those as external proxies when Host/bind disagree and ECONNRESET.
  if (!request.cookies.get(COOKIE_NAME)?.value) {
    const acceptLanguage = request.headers.get('Accept-Language') ?? '';
    const tags = acceptLanguage ? parseAcceptLanguage(acceptLanguage) : [];
    const detected: SupportedLocale = matchLocale(tags) ?? 'en';
    const alreadyOnLocale = pathname === `/${detected}` || pathname.startsWith(`/${detected}/`);
    if (!alreadyOnLocale && detected !== 'en') {
      const response = redirectTo(`/${detected}${pathname}`);
      response.cookies.set(COOKIE_NAME, detected, cookieOptions);
      return response;
    }
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, detected, cookieOptions);
    return response;
  }

  const activeLocale = (request.cookies.get(COOKIE_NAME)?.value ?? 'en') as SupportedLocale;
  if (isSupportedLocale(activeLocale) && activeLocale !== 'en') {
    const alreadyOnLocale =
      pathname === `/${activeLocale}` || pathname.startsWith(`/${activeLocale}/`);
    if (!alreadyOnLocale) {
      return redirectTo(`/${activeLocale}${pathname}`);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/(pt-br|en)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};
