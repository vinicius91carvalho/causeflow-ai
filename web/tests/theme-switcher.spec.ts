import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('causeflow-theme'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-theme') === 'original',
    { timeout: 5000 },
  );
});

test.describe('Theme System Foundation', () => {
  test('default theme is "original" with data-theme attribute set', async ({ page }) => {
    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(dataTheme).toBe('original');
  });

  test('no dark class by default', async ({ page }) => {
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDark).toBe(false);
  });

  test('CSS variables are defined for default theme', async ({ page }) => {
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
    );
    expect(bg).toBeTruthy();
    expect(bg.length).toBeGreaterThan(0);
  });
});

test.describe('Dark Mode Toggle', () => {
  test('adding .dark class changes CSS variables', async ({ page }) => {
    const { lightBg, darkBg } = await page.evaluate(() => {
      const root = document.documentElement;
      const light = getComputedStyle(root).getPropertyValue('--background').trim();
      root.classList.add('dark');
      const dark = getComputedStyle(root).getPropertyValue('--background').trim();
      return { lightBg: light, darkBg: dark };
    });

    expect(lightBg).not.toBe(darkBg);
  });
});

test.describe('Theme Persistence (localStorage)', () => {
  test('website is light-only and ignores dark localStorage preference', async ({ page }) => {
    // The marketing site uses lockColorMode — it always renders light regardless
    // of localStorage.
    await page.evaluate(() => {
      localStorage.setItem(
        'causeflow-theme',
        JSON.stringify({ themeId: 'original', colorMode: 'dark' }),
      );
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();

    // Site is light-only; dark class must NOT be set
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDark).toBe(false);

    // data-theme is overridden by the theme init script to 'original'
    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(dataTheme).toBe('original');
  });
});
