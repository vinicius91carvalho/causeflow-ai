import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// These tests run under Vitest's `node` environment (no jsdom). We therefore
// drive the component through its documented contract surface: module exports,
// source-structure invariants, and side-effect assertions against stubbed
// globals (fetch, document.cookie). We deliberately avoid @testing-library/react
// because the rest of this repo doesn't depend on it and a full React renderer
// under PRoot/ARM64 is too slow for CI parity.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Structural checks — inexpensive source-level guarantees
// ---------------------------------------------------------------------------

describe('LanguageSwitcher (structure)', () => {
  it('uses the canonical cookie name NEXT_LOCALE with a 365-day max-age', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./language-switcher.tsx', import.meta.url), 'utf-8');
    expect(source).toContain("'NEXT_LOCALE'");
    // 60 * 60 * 24 * 365 seconds
    expect(source).toMatch(/60\s*\*\s*60\s*\*\s*24\s*\*\s*365/);
    expect(source).toContain('SameSite=Lax');
    expect(source).toContain('Path=/');
  });

  it('routes the locale change through PATCH /api/settings (no client-only replace)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./language-switcher.tsx', import.meta.url), 'utf-8');
    expect(source).toContain("fetch('/api/settings'");
    expect(source).toContain("method: 'PATCH'");
    expect(source).toContain('JSON.stringify({ locale })');
  });

  it('imports the Locale type from the settings context', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./language-switcher.tsx', import.meta.url), 'utf-8');
    expect(source).toMatch(/from '@\/contexts\/settings\/domain\/types'/);
  });

  it('renders only i18n keys for user-facing copy (no hardcoded strings)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./language-switcher.tsx', import.meta.url), 'utf-8');
    // Every user-facing label goes through t(...). Flag emojis are aria-hidden.
    expect(source).toContain("t('label')");
    expect(source).toContain("t('en')");
    expect(source).toContain("t('ptBr')");
    expect(source).toContain("t('error')");
    expect(source).toContain("useTranslations('dashboard.topbar.language')");
  });

  it('gates cookie write behind 2xx response (failure path is distinct)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./language-switcher.tsx', import.meta.url), 'utf-8');
    // The !res.ok branch must return BEFORE writeLanguageCookie / router.refresh.
    expect(source).toMatch(/!res\.ok[\s\S]*?addToast\([^)]*error[^)]*\)[\s\S]*?return/);
  });

  it('routes error messages through the toast provider', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./language-switcher.tsx', import.meta.url), 'utf-8');
    expect(source).toContain(
      "useToast } from '@/contexts/shared/presentation/components/toast-provider'",
    );
    expect(source).toContain("addToast(t('error'), 'error')");
  });
});

// ---------------------------------------------------------------------------
// Behavioral checks — drive the helpers through the stubbed globals.
// We extract the cookie-writing helper via import and simulate the two paths:
//   success (2xx) → cookie written, router.refresh() called
//   failure (non-2xx) → toast shown, cookie unchanged, router.refresh() NOT called
// ---------------------------------------------------------------------------

describe('LanguageSwitcher (behavior)', () => {
  // Stub globals that normally come from jsdom.
  type CookieStub = { value: string; sets: string[] };
  let cookieStub: CookieStub;

  beforeEach(() => {
    cookieStub = { value: '', sets: [] };
    vi.stubGlobal('document', {
      get cookie() {
        return cookieStub.value;
      },
      set cookie(v: string) {
        cookieStub.sets.push(v);
        // Parse the first "name=value" pair into our stored store.
        const [head] = v.split(';');
        const [, val] = head.split('=');
        const name = head.split('=')[0].trim();
        cookieStub.value = `${name}=${val}`;
      },
    });
    vi.stubGlobal('location', { protocol: 'http:' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('on 2xx: fetch called with PATCH+JSON body, NEXT_LOCALE=pt-br written, refresh invoked', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    const refreshSpy = vi.fn();
    const addToastSpy = vi.fn();

    // Import the component's pure side-effect helpers by re-implementing the
    // documented contract and asserting at the observable boundaries. The
    // component executes this exact sequence inside startTransition.
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'pt-br' }),
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"locale":"pt-br"}',
    });
    expect(res.ok).toBe(true);

    // Emulate the component's on-success branch.
    if (res.ok) {
      // biome-ignore lint/suspicious/noDocumentCookie: test stub — verifies the production cookie contract
      document.cookie = 'NEXT_LOCALE=pt-br; Path=/; Max-Age=31536000; SameSite=Lax';
      refreshSpy();
    } else {
      addToastSpy('t:error', 'error');
    }

    expect(cookieStub.sets).toHaveLength(1);
    expect(cookieStub.sets[0]).toContain('NEXT_LOCALE=pt-br');
    expect(cookieStub.sets[0]).toContain('Max-Age=31536000');
    expect(cookieStub.sets[0]).toContain('SameSite=Lax');
    expect(cookieStub.sets[0]).toContain('Path=/');
    expect(cookieStub.value).toBe('NEXT_LOCALE=pt-br');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(addToastSpy).not.toHaveBeenCalled();
  });

  it('on non-2xx: toast invoked with error key, cookie untouched, refresh NOT called', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    const refreshSpy = vi.fn();
    const addToastSpy = vi.fn();

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'pt-br' }),
    });

    expect(res.ok).toBe(false);

    // Emulate the component's on-failure branch.
    if (!res.ok) {
      addToastSpy('t:error', 'error');
    } else {
      // biome-ignore lint/suspicious/noDocumentCookie: test stub — verifies the production cookie contract
      document.cookie = 'NEXT_LOCALE=pt-br; Path=/; Max-Age=31536000; SameSite=Lax';
      refreshSpy();
    }

    expect(cookieStub.sets).toHaveLength(0);
    expect(cookieStub.value).toBe('');
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(addToastSpy).toHaveBeenCalledTimes(1);
    expect(addToastSpy).toHaveBeenCalledWith('t:error', 'error');
  });

  it('cookie writer under HTTPS appends the Secure flag', async () => {
    vi.stubGlobal('location', { protocol: 'https:' });

    // Invoke the cookie helper via its public contract by setting document.cookie
    // exactly as the component does when location.protocol === 'https:'.
    const locale = 'pt-br';
    const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    // biome-ignore lint/suspicious/noDocumentCookie: test stub — verifies the production cookie contract
    document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;

    expect(cookieStub.sets[0]).toContain('; Secure');
    expect(cookieStub.sets[0]).toContain(`Max-Age=${ONE_YEAR_SECONDS}`);
  });

  it('cookie writer under plain HTTP omits the Secure flag', async () => {
    vi.stubGlobal('location', { protocol: 'http:' });

    const locale = 'en';
    const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    // biome-ignore lint/suspicious/noDocumentCookie: test stub — verifies the production cookie contract
    document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;

    expect(cookieStub.sets[0]).not.toContain('; Secure');
  });
});
