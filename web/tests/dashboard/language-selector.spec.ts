/**
 * Sprint 5 — Dashboard language selector E2E.
 *
 * Uses the authed storage state from `auth-setup.ts` (Clerk sign-in token).
 * Runs in the `dashboard-authed` Playwright project (see playwright.config.ts).
 *
 * Three scenarios (spec §63):
 *   1. In-session switch — click Português (Brasil), expect NEXT_LOCALE=pt-br
 *      and the language button menu to reflect the new selection.
 *   2. Reload persistence — after switching, reload and confirm the locale
 *      cookie remains `pt-br`.
 *   3. Cross-device simulation — clear NEXT_LOCALE, reload, expect the server
 *      to re-assert the persisted locale via `syncLocaleFromServer()`.
 *
 * `afterAll` restores the server-side locale to `en` via PATCH /api/settings
 * so the shared test user is idempotent across runs.
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

async function getNextLocaleCookie(
  context: import('@playwright/test').BrowserContext,
): Promise<string | null> {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === 'NEXT_LOCALE')?.value ?? null;
}

async function patchServerLocale(
  page: import('@playwright/test').Page,
  locale: 'en' | 'pt-br',
): Promise<void> {
  const res = await page.request.patch(`${DASHBOARD_URL}/api/settings`, {
    data: { locale },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) {
    // Non-fatal — log so the restore step is visible in CI output.
    console.warn(
      `[language-selector.spec] PATCH /api/settings { locale: ${locale} } → ${res.status()}`,
    );
  }
}

test.describe('Dashboard — language selector', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test.afterAll(async ({ browser }) => {
    // Restore persisted locale to `en` so the shared test user starts in a
    // known state next run. Uses a fresh context with the stored auth state.
    const context = await browser.newContext({
      storageState: 'tests/dashboard/.auth/user.json',
    });
    const page = await context.newPage();
    await blockTrackers(page);
    await patchServerLocale(page, 'en');
    await context.close();
  });

  test('in-session switch: clicking Português (Brasil) sets NEXT_LOCALE=pt-br', async ({
    page,
    context,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Open the language menu. The button lives in the topbar; aria-label uses
    // dashboard.topbar.language.label. The EN copy is "Language" (see
    // contexts/shared/infrastructure/i18n/en.json).
    const languageTrigger = page.getByRole('button', { name: /language/i }).first();
    await expect(languageTrigger).toBeVisible({ timeout: 10_000 });
    await languageTrigger.click();

    // Click the Português (Brasil) menu item.
    const ptBrItem = page.getByRole('menuitemradio', { name: /portugu[eê]s/i });
    await expect(ptBrItem).toBeVisible({ timeout: 5_000 });
    await ptBrItem.click();

    // Wait for the PATCH /api/settings request to complete and the router
    // refresh to re-render. A short settle is enough — language-switcher.tsx
    // calls router.refresh() after the fetch resolves.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {
      // networkidle may not fire in dev; fall back to a small wait.
    });

    const locale = await getNextLocaleCookie(context);
    expect(locale).toBe('pt-br');
  });

  test('reload persistence: NEXT_LOCALE stays pt-br after page reload', async ({
    page,
    context,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Cookie should already be pt-br from the previous test (serial mode).
    expect(await getNextLocaleCookie(context)).toBe('pt-br');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    expect(await getNextLocaleCookie(context)).toBe('pt-br');
  });

  test('cross-device simulation: deleting NEXT_LOCALE then reloading re-asserts pt-br from server', async ({
    page,
    context,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Clear both NEXT_LOCALE and the sync sentinel, then reload. The
    // authenticated layout should call syncLocaleFromServer() and rewrite
    // NEXT_LOCALE=pt-br based on the persisted UserSettingsEntity.locale.
    const currentCookies = await context.cookies();
    const keep = currentCookies.filter(
      (c) => c.name !== 'NEXT_LOCALE' && c.name !== 'cf_locale_synced',
    );
    await context.clearCookies();
    await context.addCookies(keep);

    expect(await getNextLocaleCookie(context)).toBeNull();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Wait briefly for the server component's cookies().set() to be flushed
    // to the client. Set-Cookie headers from layouts arrive on the HTML
    // response; the next cookies() call in the browser reflects them.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const locale = await getNextLocaleCookie(context);
    expect(locale).toBe('pt-br');
  });
});
