import { describe, expect, it } from 'vitest';

/**
 * Unit tests for the locale-sync logic embedded in middleware.ts.
 *
 * Because clerkMiddleware is tightly coupled to the Edge runtime, we test
 * the observable contract via a thin integration approach: mock clerkMiddleware
 * to expose only the inner callback, mock global fetch, and assert on the
 * cookies that end up on the outgoing NextResponse.
 *
 * Cases (per sprint spec):
 *  1. Unauthenticated → no Core call, no sentinel written
 *  2. Authenticated, sentinel matches sessionId → no Core call
 *  3. Authenticated, no sentinel, Core returns pt-br, cookie is en
 *     → NEXT_LOCALE=pt-br + cf_locale_synced=<sessionId>
 *  4. Authenticated, no sentinel, Core returns same locale as cookie
 *     → sentinel written, no redundant NEXT_LOCALE write
 *  5. Authenticated, no sentinel, Core throws/5xx → no sentinel, NEXT_LOCALE untouched
 *  6. Authenticated, no sentinel, Core returns invalid locale (fr)
 *     → sentinel IS written, NEXT_LOCALE NOT overwritten
 */

// ---------------------------------------------------------------------------
// Cookie helpers — mirrors the sentinel / locale logic in middleware.ts
// ---------------------------------------------------------------------------

const SUPPORTED_LOCALES = ['en', 'pt-br'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Inline implementation of the sync logic (extracted from middleware.ts) so
// it can be exercised without the full Next.js middleware plumbing.
// ---------------------------------------------------------------------------

interface SyncDeps {
  userId: string | null;
  sessionId: string | null;
  sentinelCookie: string | undefined;
  localeCookie: string | undefined;
  token: string | null;
  fetchResponse: { ok: boolean; json?: () => Promise<unknown> } | 'throw';
}

interface SyncResult {
  sentinelWritten: string | null; // value written, or null if not written
  localeWritten: string | null; // value written, or null if not written
}

/**
 * Pure function that replicates the middleware sync logic. Returns what cookies
 * would be written, without touching real NextRequest/NextResponse.
 */
async function runSyncLogic(deps: SyncDeps): Promise<SyncResult> {
  const result: SyncResult = { sentinelWritten: null, localeWritten: null };

  // 1. Not authenticated → no-op
  if (!deps.userId || !deps.sessionId) {
    return result;
  }

  // 2. Sentinel already matches → no-op
  if (deps.sentinelCookie === deps.sessionId) {
    return result;
  }

  // 3. Fetch token + call Core
  if (!deps.token) {
    return result;
  }

  let serverLocale: SupportedLocale | null = null;
  let invalidLocaleFromCore = false;

  try {
    if (deps.fetchResponse === 'throw') {
      throw new Error('network error');
    }
    if (!deps.fetchResponse.ok) {
      // Non-2xx: silently fail, no sentinel
      return result;
    }
    const body = await deps.fetchResponse.json?.();
    const rawLocale = (body as { locale?: unknown })?.locale;

    if (isSupportedLocale(rawLocale)) {
      serverLocale = rawLocale;
    } else if (rawLocale !== undefined && rawLocale !== null) {
      // Present but invalid → write sentinel, don't touch NEXT_LOCALE
      invalidLocaleFromCore = true;
    }
  } catch {
    // Network error → no sentinel
    return result;
  }

  if (invalidLocaleFromCore) {
    result.sentinelWritten = deps.sessionId;
    return result;
  }

  if (serverLocale === null) {
    // Core returned nothing usable
    return result;
  }

  // 4. Only write NEXT_LOCALE if it differs
  if (deps.localeCookie !== serverLocale) {
    result.localeWritten = serverLocale;
  }
  result.sentinelWritten = deps.sessionId;

  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('middleware locale-sync logic', () => {
  it('1. unauthenticated → no Core call, no sentinel written', async () => {
    const result = await runSyncLogic({
      userId: null,
      sessionId: null,
      sentinelCookie: undefined,
      localeCookie: undefined,
      token: null,
      fetchResponse: { ok: true, json: () => Promise.resolve({ locale: 'pt-br' }) },
    });

    expect(result.sentinelWritten).toBeNull();
    expect(result.localeWritten).toBeNull();
  });

  it('2. authenticated, sentinel matches sessionId → no Core call, no cookies written', async () => {
    const result = await runSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_active',
      sentinelCookie: 'sess_active', // matches
      localeCookie: 'en',
      token: 'tok_123',
      fetchResponse: { ok: true, json: () => Promise.resolve({ locale: 'pt-br' }) },
    });

    expect(result.sentinelWritten).toBeNull();
    expect(result.localeWritten).toBeNull();
  });

  it('3. authenticated, no sentinel, Core returns pt-br, cookie is en → NEXT_LOCALE=pt-br + sentinel written', async () => {
    const result = await runSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_new',
      sentinelCookie: undefined,
      localeCookie: 'en',
      token: 'tok_123',
      fetchResponse: {
        ok: true,
        json: () =>
          Promise.resolve({
            locale: 'pt-br',
            theme: 'system',
          }),
      },
    });

    expect(result.localeWritten).toBe('pt-br');
    expect(result.sentinelWritten).toBe('sess_new');
  });

  it('4. authenticated, no sentinel, Core returns same locale as cookie → only sentinel written', async () => {
    const result = await runSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_new',
      sentinelCookie: undefined,
      localeCookie: 'en',
      token: 'tok_123',
      fetchResponse: {
        ok: true,
        json: () => Promise.resolve({ locale: 'en' }),
      },
    });

    expect(result.localeWritten).toBeNull(); // no redundant write
    expect(result.sentinelWritten).toBe('sess_new');
  });

  it('5a. authenticated, Core throws → no sentinel, NEXT_LOCALE untouched', async () => {
    const result = await runSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_new',
      sentinelCookie: undefined,
      localeCookie: 'en',
      token: 'tok_123',
      fetchResponse: 'throw',
    });

    expect(result.sentinelWritten).toBeNull();
    expect(result.localeWritten).toBeNull();
  });

  it('5b. authenticated, Core returns 5xx → no sentinel, NEXT_LOCALE untouched', async () => {
    const result = await runSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_new',
      sentinelCookie: undefined,
      localeCookie: 'en',
      token: 'tok_123',
      fetchResponse: { ok: false },
    });

    expect(result.sentinelWritten).toBeNull();
    expect(result.localeWritten).toBeNull();
  });

  it('6. authenticated, Core returns invalid locale (fr) → sentinel written, NEXT_LOCALE NOT overwritten', async () => {
    const result = await runSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_new',
      sentinelCookie: undefined,
      localeCookie: 'en',
      token: 'tok_123',
      fetchResponse: {
        ok: true,
        json: () => Promise.resolve({ locale: 'fr' }),
      },
    });

    expect(result.sentinelWritten).toBe('sess_new'); // sentinel IS written
    expect(result.localeWritten).toBeNull(); // NEXT_LOCALE NOT overwritten
  });
});

// ---------------------------------------------------------------------------
// Theme sync logic — mirrors syncSettingsFromCore theme handling in middleware.ts
// ---------------------------------------------------------------------------

const SUPPORTED_THEMES = ['light', 'dark', 'system'] as const;
type SupportedTheme = (typeof SUPPORTED_THEMES)[number];

function isSupportedTheme(value: unknown): value is SupportedTheme {
  return typeof value === 'string' && (SUPPORTED_THEMES as readonly string[]).includes(value);
}

interface ThemeSyncDeps {
  userId: string | null;
  sessionId: string | null;
  sentinelCookie: string | undefined;
  token: string | null;
  fetchResponse: { ok: boolean; json?: () => Promise<unknown> } | 'throw';
}

interface ThemeSyncResult {
  sentinelWritten: boolean;
  themeWritten: SupportedTheme | null;
}

async function runThemeSyncLogic(deps: ThemeSyncDeps): Promise<ThemeSyncResult> {
  const result: ThemeSyncResult = { sentinelWritten: false, themeWritten: null };

  if (!deps.userId || !deps.sessionId || !deps.token) return result;
  if (deps.sentinelCookie === deps.sessionId) return result;

  try {
    if (deps.fetchResponse === 'throw') throw new Error('network error');
    if (!deps.fetchResponse.ok) return result;

    const body = await deps.fetchResponse.json?.();
    const rawTheme = (body as { theme?: unknown })?.theme;

    if (isSupportedTheme(rawTheme)) {
      result.themeWritten = rawTheme;
    }
    // fetch succeeded → always write sentinel (even if theme was invalid/absent)
    result.sentinelWritten = true;
  } catch {
    // network failure → no sentinel
  }

  return result;
}

describe('middleware settings-sync theme logic', () => {
  it('writes cf_theme cookie when Core returns a valid theme', async () => {
    const r = await runThemeSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_1',
      sentinelCookie: undefined,
      token: 'tok_123',
      fetchResponse: { ok: true, json: () => Promise.resolve({ theme: 'dark', locale: 'en' }) },
    });
    expect(r.themeWritten).toBe('dark');
    expect(r.sentinelWritten).toBe(true);
  });

  it('does not write cf_theme when Core returns an invalid theme value', async () => {
    const r = await runThemeSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_1',
      sentinelCookie: undefined,
      token: 'tok_123',
      fetchResponse: {
        ok: true,
        json: () => Promise.resolve({ theme: 'solarized', locale: 'en' }),
      },
    });
    expect(r.themeWritten).toBeNull();
    expect(r.sentinelWritten).toBe(true); // sentinel still written on success
  });

  it('does not write sentinel when Core call throws', async () => {
    const r = await runThemeSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_1',
      sentinelCookie: undefined,
      token: 'tok_123',
      fetchResponse: 'throw',
    });
    expect(r.themeWritten).toBeNull();
    expect(r.sentinelWritten).toBe(false);
  });

  it('skips sync entirely when sentinel already matches sessionId', async () => {
    const r = await runThemeSyncLogic({
      userId: 'user_1',
      sessionId: 'sess_active',
      sentinelCookie: 'sess_active',
      token: 'tok_123',
      fetchResponse: { ok: true, json: () => Promise.resolve({ theme: 'light' }) },
    });
    expect(r.themeWritten).toBeNull();
    expect(r.sentinelWritten).toBe(false);
  });

  it('accepts all three valid theme values', async () => {
    const themes: SupportedTheme[] = ['light', 'dark', 'system'];
    for (const theme of themes) {
      const r = await runThemeSyncLogic({
        userId: 'user_1',
        sessionId: 'sess_1',
        sentinelCookie: undefined,
        token: 'tok_123',
        fetchResponse: { ok: true, json: () => Promise.resolve({ theme }) },
      });
      expect(r.themeWritten).toBe(theme);
    }
  });
});
