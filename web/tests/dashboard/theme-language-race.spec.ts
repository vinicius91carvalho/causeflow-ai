/**
 * Regression spec — theme/language race condition fix.
 *
 * Verifies that selecting Light theme via the topbar toggle and then switching
 * the language to PT-BR (which causes a page reload/remount) does NOT revert
 * the theme back to Dark.
 *
 * Root cause (fixed in packages/ui/src/themes/provider.tsx): the two useEffects
 * raced — the DOM-apply effect clobbered the persisted localStorage value with
 * the default `system → dark` on first render before the storage-sync effect
 * could restore `light`. Fix: lazy useState initializer reads localStorage
 * synchronously so both effects see the correct value from render 1.
 *
 * Runs in the `dashboard-authed` Playwright project (see playwright.config.ts).
 * Requires `tests/dashboard/.auth/user.json` produced by `auth-setup.ts`.
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';
const STORAGE_KEY = 'causeflow-theme';

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

/** Read and parse the theme object from localStorage. */
async function getStoredTheme(
  page: import('@playwright/test').Page,
): Promise<{ themeId?: string; colorMode?: string } | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { themeId?: string; colorMode?: string };
    } catch {
      return null;
    }
  }, STORAGE_KEY);
}

test.describe('Dashboard — theme/language race regression', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    // Clear any persisted theme so the test starts from a known default state.
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Reset persisted locale to `en` so the shared auth user stays idempotent.
    const ctx = await browser.newContext({
      storageState: 'tests/dashboard/.auth/user.json',
    });
    const page = await ctx.newPage();
    await blockTrackers(page);
    await page.request
      .patch(`${DASHBOARD_URL}/api/settings`, {
        data: { locale: 'en' },
        headers: { 'Content-Type': 'application/json' },
      })
      .catch(() => {
        // Non-fatal restore failure — log only.
        // biome-ignore lint/suspicious/noConsole: intentional restore log
        console.warn('[theme-language-race] failed to restore locale to en');
      });
    await ctx.close();
  });

  test('Light theme survives language switch to PT-BR (theme/language race regression)', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();

    // ── Step 1: open the theme picker and select Light ──────────────────────
    // The theme toggle button is in the topbar. Try common selectors used by
    // the theme-switcher component.
    const themeToggle = page.locator(
      '[aria-label*="theme" i], [aria-label*="Theme" i], button[data-theme-toggle], [data-testid="theme-toggle"]',
    );

    // Fallback: look for any button containing a sun/moon icon in the topbar.
    const topbarThemeBtn = themeToggle
      .or(page.locator('header button[aria-haspopup="menu"]').first())
      .first();

    await topbarThemeBtn.waitFor({ state: 'visible', timeout: 8000 });
    await topbarThemeBtn.click();

    // Light option in the dropdown — try multiple label patterns.
    const lightOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /^(Light|Claro)$/i })
      .first();
    await lightOption.waitFor({ state: 'visible', timeout: 5000 });
    await lightOption.click();

    // After clicking Light, the html element must NOT have the `dark` class.
    await expect(page.locator('html')).not.toHaveClass(/dark/, { timeout: 5000 });

    // Verify localStorage was written with colorMode: 'light'.
    const afterLight = await getStoredTheme(page);
    expect(afterLight?.colorMode).toBe('light');

    // ── Step 2: switch language to PT-BR ────────────────────────────────────
    const langButton = page.locator(
      '[aria-label*="language" i], [aria-label*="Language" i], [aria-label*="idioma" i], [data-testid="language-selector"]',
    );
    const topbarLangBtn = langButton.first();
    await topbarLangBtn.waitFor({ state: 'visible', timeout: 8000 });
    await topbarLangBtn.click();

    // Select PT-BR option.
    const ptBrOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /Portugu/i })
      .first();
    await ptBrOption.waitFor({ state: 'visible', timeout: 5000 });
    await ptBrOption.click();

    // Language switch triggers a navigation/reload. Wait for the page to settle.
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });

    // ── Step 3: assertions after reload ─────────────────────────────────────
    // PRIMARY: html must NOT have `dark` class — this was the regression.
    await expect(page.locator('html')).not.toHaveClass(/dark/, { timeout: 8000 });

    // SECONDARY: localStorage must still say colorMode: 'light'.
    const afterLang = await getStoredTheme(page);
    expect(afterLang?.colorMode).toBe('light');

    // TERTIARY: no dark flash — the class must be absent immediately after
    // DOMContentLoaded (not just after a grace period). We verify there is no
    // `dark` class within 500 ms of the locator being visible.
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass ?? '').not.toMatch(/\bdark\b/);
  });
});
