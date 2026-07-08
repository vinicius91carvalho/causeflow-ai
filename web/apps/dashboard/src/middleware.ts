import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Open-source local-runtime middleware.
 *
 * Replaces the Clerk `clerkMiddleware()` (removed per AC-046). Auth is a local
 * short-lived JWT issued by the CauseFlow Core API and stored in an `__session`
 * httpOnly cookie (see `/api/auth/login`). This middleware only checks for the
 * cookie's presence and redirects unauthenticated requests to `/auth/sign-in`;
 * the JWT itself is verified by `withAuth` via the Core's `whoami` on each
 * authenticated API call. No outbound call to clerk.com / stripe.com /
 * amazonaws.com / sentry.io / sst. is made at boot or per-request here.
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

// Public routes — mirror the previous Clerk `isPublicRoute` matcher so
// AC-019/AC-020 behavior is preserved.
const PUBLIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/api\/health(\.|$)/,
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

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((entry) => {
      const [tag, q] = entry.trim().split(';q=');
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
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${cookieLocale}${pathname === '/' ? '' : pathname}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    path: '/',
    ...(isProduction ? { secure: true } : {}),
  };

  // Public routes — no auth required; run i18n middleware.
  if (isPublicRoute(pathname)) {
    return intlMiddleware(request);
  }

  // Protect all non-public routes: require the local __session cookie.
  // (The JWT is verified server-side by `withAuth` via Core whoami.)
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Authenticated — run i18n middleware (locale detection).
  if (!request.cookies.get(COOKIE_NAME)?.value) {
    const acceptLanguage = request.headers.get('Accept-Language') ?? '';
    const tags = acceptLanguage ? parseAcceptLanguage(acceptLanguage) : [];
    const detected: SupportedLocale = matchLocale(tags) ?? 'en';
    const alreadyOnLocale = pathname === `/${detected}` || pathname.startsWith(`/${detected}/`);
    if (!alreadyOnLocale && detected !== 'en') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${detected}${pathname}`;
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set(COOKIE_NAME, detected, cookieOptions);
      return response;
    }
    const response = intlMiddleware(request);
    response.cookies.set(COOKIE_NAME, 'en', cookieOptions);
    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(pt-br|en)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};
