import { checkStagingAuth } from '@causeflow/shared/infrastructure/middleware/staging-auth';
import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { type Locale, routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const SUPPORTED_LOCALES = routing.locales;

const COOKIE_NAME = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Known crawler/bot user-agent substrings (lowercase).
 * Crawlers must never be redirected — they index the canonical URLs directly.
 * Google recommends serving the same locale URL to all crawlers (hreflang
 * handles the per-locale signals). A redirect loop or geo-redirect seen by
 * Googlebot can cause deindexing of pages.
 */
const CRAWLER_UA_PATTERNS = [
  'googlebot',
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'applebot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'rogerbot',
  'screaming frog',
  'ia_archiver', // Wayback Machine
  'petalbot',
  'sogou',
];

/**
 * Returns true when the User-Agent belongs to a known crawler or bot.
 * Crawlers are never redirected so they always index the canonical locale URLs.
 */
function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}

/**
 * Parse Accept-Language header and return an ordered list of language tags
 * by descending quality value (q= weight, default 1.0).
 */
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

/**
 * Match a list of Accept-Language tags against supported locales.
 * Tries exact match first, then language-prefix match (e.g. "pt" → "pt-br").
 */
function matchLocale(tags: string[]): Locale | null {
  for (const tag of tags) {
    // Exact match
    if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
      return tag as Locale;
    }
    // Prefix match: e.g. "pt-PT" or "pt" → "pt-br"
    const prefix = tag.split('-')[0];
    const prefixMatch = SUPPORTED_LOCALES.find(
      (locale) => locale.startsWith(`${prefix}-`) || locale === prefix,
    );
    if (prefixMatch) {
      return prefixMatch;
    }
  }
  return null;
}

export default function middleware(request: NextRequest) {
  const stagingAuthResponse = checkStagingAuth(request);
  if (stagingAuthResponse) return stagingAuthResponse;

  const pathname = request.nextUrl.pathname;

  // Skip the intl middleware for internal paths that don't need locale routing.
  // /en/* are internal rewrites from the intl middleware itself (prevents loop).
  // /staging-auth is the staging login gate — no locale needed.
  if (pathname === '/en' || pathname.startsWith('/en/') || pathname === '/staging-auth') {
    return NextResponse.next();
  }

  const localeCookie = request.cookies.get(COOKIE_NAME);

  // First visit: no NEXT_LOCALE cookie — run Accept-Language + geo detection.
  //
  // SEO contract:
  //   - Crawlers are NEVER redirected. They index the canonical URL at each
  //     locale path directly. hreflang signals handle locale discovery.
  //   - Human first-time visitors with a PT Accept-Language are redirected
  //     once (302) to /pt-br/ and a NEXT_LOCALE cookie is set so the redirect
  //     never repeats.
  //   - CloudFront's CloudFront-Viewer-Country header is also checked; if the
  //     user is in Brazil (BR) they are directed to /pt-br/ even if their
  //     browser Accept-Language is misconfigured.
  //   - After the first visit the cookie drives locale — no further detection.
  if (!localeCookie) {
    const userAgent = request.headers.get('User-Agent') ?? '';

    // Crawlers bypass detection entirely — pass straight to intlMiddleware.
    if (isCrawler(userAgent)) {
      return intlMiddleware(request);
    }

    // Check CloudFront geo header.
    // SST's CloudFront Function renames `cloudfront-viewer-country` to
    // `x-open-next-country` before forwarding to the Lambda origin.
    // We check both names for forward-compatibility.
    const cfCountry =
      request.headers.get('x-open-next-country') ??
      request.headers.get('CloudFront-Viewer-Country') ??
      '';

    // Check Accept-Language header.
    const acceptLanguage = request.headers.get('Accept-Language') ?? '';
    const tags = acceptLanguage ? parseAcceptLanguage(acceptLanguage) : [];
    const detectedFromAcceptLang: Locale = matchLocale(tags) ?? 'en';

    // Geo-detection: Brazil → PT-BR regardless of Accept-Language.
    const detectedFromGeo: Locale | null = cfCountry.toUpperCase() === 'BR' ? 'pt-br' : null;

    // Geo takes priority; fall back to Accept-Language detection.
    const detected: Locale = detectedFromGeo ?? detectedFromAcceptLang;

    // If a non-English locale was detected and the user is not already on that
    // path, redirect to the correct locale prefix.
    if (detected !== 'en') {
      const alreadyOnLocale = pathname === `/${detected}` || pathname.startsWith(`/${detected}/`);
      if (!alreadyOnLocale) {
        const redirectUrl = request.nextUrl.clone();
        // When redirecting from /, go to /pt-br/ (not /pt-br//).
        redirectUrl.pathname = pathname === '/' ? `/${detected}` : `/${detected}${pathname}`;
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set(COOKIE_NAME, detected, {
          maxAge: COOKIE_MAX_AGE,
          sameSite: 'lax',
          path: '/',
        });
        return response;
      }
    }

    // English or no match: pass to intlMiddleware and set cookie to 'en'.
    const response = intlMiddleware(request);
    response.cookies.set(COOKIE_NAME, 'en', {
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
    return response;
  }

  // Cookie exists — skip detection, delegate directly to intlMiddleware.
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(pt-br|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
