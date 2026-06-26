import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const SUPPORTED_LOCALES = ['en', 'pt-br'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const COOKIE_NAME = 'NEXT_LOCALE';
const SENTINEL_COOKIE = 'cf_settings_synced';
const THEME_COOKIE = 'cf_theme';
const LOCALE_COOKIE = 'cf_locale';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const SUPPORTED_THEMES = ['light', 'dark', 'system'] as const;
type SupportedTheme = (typeof SUPPORTED_THEMES)[number];

function isSupportedTheme(value: unknown): value is SupportedTheme {
  return typeof value === 'string' && (SUPPORTED_THEMES as readonly string[]).includes(value);
}

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const isPublicRoute = createRouteMatcher([
  '/api/health(.*)',
  '/api/ingestion/webhook',
  '/auth/(.*)',
  '/(en|pt-br)/auth/(.*)',
  '/accept-invitation(.*)',
  '/(en|pt-br)/accept-invitation(.*)',
  '/beta-waitlist(.*)',
  '/(en|pt-br)/beta-waitlist(.*)',
  '/waitlist(.*)',
  '/(en|pt-br)/waitlist(.*)',
  '/create-organization(.*)',
  '/(en|pt-br)/create-organization(.*)',
  // Plan-gate enforcement moved to the dashboard layout server component
  // (see src/app/[locale]/dashboard/layout.tsx). /onboarding/* is auth-required
  // but does not need plan verification.
  '/',
  '/en',
  '/pt-br',
]);

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

interface SettingsSyncResult {
  /** Resolved locale from Core API, or null if not resolved / already synced. */
  locale: SupportedLocale | null;
  /** Resolved theme from Core API, or null if not resolved. */
  theme: SupportedTheme | null;
  /**
   * Whether the sentinel should be written.
   * True when the fetch succeeded (even if data was invalid) or invalid data was returned.
   * False when the fetch failed (network/5xx) — let the next request retry.
   */
  writeSentinel: boolean;
}

/**
 * Syncs both theme and locale from Core API in a single round-trip.
 * Renamed from syncLocaleFromCore — now also writes cf_theme and cf_locale cookies.
 *
 * Sentinel cookie: cf_settings_synced (replaces cf_locale_synced).
 * Runs at most once per Clerk session. Fail-safe: any error is silently ignored
 * and the sentinel is NOT written on failure so the next request retries Core.
 *
 * Cookie security: values are validated against their enums before being written.
 * Invalid/unexpected values are silently ignored — only known-good enum values pass.
 */
async function syncSettingsFromCore(
  request: NextRequest,
  userId: string,
  sessionId: string,
  token: string,
): Promise<SettingsSyncResult> {
  const noOp: SettingsSyncResult = { locale: null, theme: null, writeSentinel: false };

  // Already synced this session → skip
  const sentinel = request.cookies.get(SENTINEL_COOKIE)?.value;
  if (sentinel === sessionId) {
    return noOp;
  }

  const coreApiUrl = process.env.CORE_API_URL;
  if (!coreApiUrl) {
    // No Core API in local dev — skip sync silently
    return noOp;
  }

  try {
    const res = await fetch(`${coreApiUrl}/v1/users/${userId}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      // Non-2xx → fail-safe, no sentinel
      return noOp;
    }

    const body = (await res.json()) as { locale?: unknown; theme?: unknown };

    // Validate locale against enum — reject anything outside {en, pt-br}
    const rawLocale = body?.locale;
    let resolvedLocale: SupportedLocale | null = null;
    if (isSupportedLocale(rawLocale)) {
      resolvedLocale = rawLocale;
    } else if (rawLocale !== undefined && rawLocale !== null) {
      console.warn(
        `[middleware] Core returned invalid locale "${rawLocale}" for user ${userId}; ignoring`,
      );
    }

    // Validate theme against enum — reject anything outside {light, dark, system}
    const rawTheme = body?.theme;
    let resolvedTheme: SupportedTheme | null = null;
    if (isSupportedTheme(rawTheme)) {
      resolvedTheme = rawTheme;
    } else if (rawTheme !== undefined && rawTheme !== null) {
      console.warn(
        `[middleware] Core returned invalid theme "${rawTheme}" for user ${userId}; ignoring`,
      );
    }

    // Fetch succeeded — write sentinel regardless of whether data was valid
    // (prevents refetch storms on persistently bad data from Core)
    return { locale: resolvedLocale, theme: resolvedTheme, writeSentinel: true };
  } catch (err) {
    // Network failure → fail-safe, no sentinel (allow retry on next request)
    console.warn(
      `[middleware] Core settings sync failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return noOp;
  }
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Dev-only: rewrite lvh.me loopback back to localhost so Clerk's session
  // cookie (scoped to localhost) is valid. The checkout handler rewrites
  // localhost → lvh.me to bypass the Core API's WAF SSRF filter, but Stripe
  // redirects the browser to lvh.me where the __session cookie is absent.
  if (process.env.NODE_ENV === 'development' && request.nextUrl.hostname === 'lvh.me') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = 'localhost';
    return NextResponse.redirect(redirectUrl);
  }

  // API routes — skip i18n middleware entirely (no locale rewriting)
  if (pathname.startsWith('/api/')) {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
    return;
  }

  // Honor NEXT_LOCALE cookie for non-prefixed paths. next-intl's
  // `localeDetection: false` keeps unprefixed paths on the default locale
  // even when the user selected pt-br, so route `/` (or `/dashboard`) to
  // `/pt-br` (or `/pt-br/dashboard`) when the cookie says so.
  {
    const cookieLocale = (request as NextRequest).cookies.get(COOKIE_NAME)?.value;
    const hasLocalePrefix = SUPPORTED_LOCALES.some(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
    );
    if (!hasLocalePrefix && isSupportedLocale(cookieLocale) && cookieLocale !== 'en') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${cookieLocale}${pathname === '/' ? '' : pathname}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  // In dev mode, Clerk needs to initialize the dev browser token before
  // intlMiddleware runs. If we return a response (rewrite/redirect) from
  // intlMiddleware before the dev browser is ready, Clerk wraps it with its
  // own redirect and creates an infinite loop. Use a simple rewrite (not
  // intlMiddleware) so Next.js can route to the correct [locale] segment
  // while Clerk initializes its dev browser token.
  if (
    process.env.NODE_ENV === 'development' &&
    !(request as NextRequest).cookies.has('__clerk_db_jwt') &&
    !request.nextUrl.searchParams.has('__clerk_db_jwt')
  ) {
    const hasLocalePrefix = SUPPORTED_LOCALES.some(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
    );
    if (!hasLocalePrefix) {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return NextResponse.rewrite(url);
    }
    return;
  }

  // Public routes — no auth required
  if (isPublicRoute(request)) {
    return intlMiddleware(request as NextRequest);
  }

  // Protect all non-public routes
  const session = await auth.protect();

  // If user is authenticated but has no active organization, redirect to org selection
  if (!session.orgId && !pathname.includes('/create-organization')) {
    const orgSelectUrl = request.nextUrl.clone();
    orgSelectUrl.pathname = '/create-organization';
    return NextResponse.redirect(orgSelectUrl);
  }

  // Plan gate enforcement lives in the dashboard layout server component —
  // see src/app/[locale]/dashboard/layout.tsx. It reads the authoritative
  // subscription state from Core API on every full navigation (React cache()
  // dedupes per request), so there is no cookie/staleness problem.

  // ---------------------------------------------------------------------------
  // Server-side settings sync (once per Clerk session)
  //
  // Fetches theme + locale from Core API in a single round-trip and writes:
  //   cf_theme         — theme enum value (light|dark|system)
  //   cf_locale        — locale enum value (en|pt-br)
  //   cf_settings_synced — sentinel (sessionId) to skip future syncs this session
  //   NEXT_LOCALE      — next-intl locale cookie (overridden by server value)
  //
  // Runs after auth.protect() so we have session.userId + session.sessionId.
  // On success, the resolved locale overrides effectiveLocaleCookie for the
  // rest of this invocation so locale detection reads the authoritative value.
  // ---------------------------------------------------------------------------

  // effectiveLocaleCookie starts as the current NEXT_LOCALE cookie value.
  // If sync resolves a server locale, it gets overridden.
  let effectiveLocaleCookie = (request as NextRequest).cookies.get(COOKIE_NAME)?.value;
  let syncedSessionId: string | null = null;
  let syncedLocale: string | null = null;
  let syncedTheme: string | null = null;

  const isProduction = process.env.NODE_ENV === 'production';

  const { userId, sessionId } = session;
  if (userId && sessionId) {
    const sentinel = (request as NextRequest).cookies.get(SENTINEL_COOKIE)?.value;

    if (sentinel !== sessionId) {
      // Sentinel absent or stale — attempt sync
      const token = await session.getToken();
      if (token) {
        const result = await syncSettingsFromCore(request as NextRequest, userId, sessionId, token);

        if (result.writeSentinel) {
          syncedSessionId = sessionId;
        }
        if (result.locale !== null) {
          syncedLocale = result.locale;
          effectiveLocaleCookie = result.locale;
        }
        if (result.theme !== null) {
          syncedTheme = result.theme;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Locale detection (uses effectiveLocaleCookie which may have been overridden)
  // ---------------------------------------------------------------------------

  const cookieOptions = {
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    path: '/',
    ...(isProduction ? { secure: true } : {}),
  };

  /**
   * Helper: write all synced settings cookies onto a response.
   * Called at every response-return point to ensure cookies are always written.
   */
  function writeSettingsCookies(response: NextResponse): void {
    if (syncedSessionId) {
      response.cookies.set(SENTINEL_COOKIE, syncedSessionId, cookieOptions);
    }
    if (syncedLocale) {
      response.cookies.set(LOCALE_COOKIE, syncedLocale, cookieOptions);
    }
    if (syncedTheme) {
      response.cookies.set(THEME_COOKIE, syncedTheme, cookieOptions);
    }
  }

  if (!effectiveLocaleCookie) {
    const acceptLanguage = request.headers.get('Accept-Language') ?? '';
    const tags = acceptLanguage ? parseAcceptLanguage(acceptLanguage) : [];
    const detected: SupportedLocale = matchLocale(tags) ?? 'en';

    if (detected !== 'en') {
      const alreadyOnLocale = pathname === `/${detected}` || pathname.startsWith(`/${detected}/`);
      if (!alreadyOnLocale) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `/${detected}${pathname}`;
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set(COOKIE_NAME, detected, cookieOptions);
        writeSettingsCookies(response);
        return response;
      }
    }

    const response = intlMiddleware(request as NextRequest);
    response.cookies.set(COOKIE_NAME, 'en', cookieOptions);
    writeSettingsCookies(response);
    return response;
  }

  // Cookie present (possibly updated by sync above)
  const response = intlMiddleware(request as NextRequest);

  // Write NEXT_LOCALE if sync changed it
  if (syncedLocale && syncedLocale !== (request as NextRequest).cookies.get(COOKIE_NAME)?.value) {
    response.cookies.set(COOKIE_NAME, syncedLocale, cookieOptions);
  }

  writeSettingsCookies(response);

  return response;
});

export const config = {
  matcher: ['/', '/(pt-br|en)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};
