import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from '@playwright/test';

/**
 * P0 verification screenshots — 2026-04-19
 *
 * Captures targeted full-page and viewport screenshots for the P0 fixes
 * identified in the website persona reports. Each test navigates to a route,
 * waits for the page to settle, then saves a PNG into:
 *   .artifacts/playwright/screenshots/p0-verify-2026-04-19/
 *
 * Run with:
 *   SKIP_WEB_SERVER=1 BASE_URL=http://localhost:3000 \
 *     pnpm exec playwright test tests/e2e/review/p0-verify.spec.ts \
 *     --project=chromium-wide --reporter=list
 */

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../.artifacts/playwright/screenshots/p0-verify-2026-04-19',
);

const BLOCKED_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'c.bing.com'];

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

test.beforeAll(() => {
  ensureDir(SCREENSHOT_DIR);
});

// ---------------------------------------------------------------------------
// home-desktop-fullpage.png — route /, 1440x900, fullPage
// ---------------------------------------------------------------------------
test('home-desktop-fullpage', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  const response = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  console.log(`home / status: ${response?.status()}`);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'home-desktop-fullpage.png'),
    fullPage: true,
  });

  await ctx.close();
});

// ---------------------------------------------------------------------------
// home-footer-desktop.png — route /, 1440x900, scroll to bottom, viewport-only
// ---------------------------------------------------------------------------
test('home-footer-desktop', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  const response = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  console.log(`home-footer / status: ${response?.status()}`);

  // Wait for footer to be present in DOM, then scroll it into view
  const footer = page.locator('footer').first();
  await footer.waitFor({ state: 'attached', timeout: 10000 });
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Viewport-only screenshot (no fullPage)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'home-footer-desktop.png'),
    fullPage: false,
  });

  await ctx.close();
});

// ---------------------------------------------------------------------------
// product-desktop-fullpage.png — route /product, 1440x900, fullPage
// ---------------------------------------------------------------------------
test('product-desktop-fullpage', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  const response = await page.goto(`${BASE}/product`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  console.log(`/product status: ${response?.status()}`);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'product-desktop-fullpage.png'),
    fullPage: true,
  });

  await ctx.close();
});

// ---------------------------------------------------------------------------
// use-cases-desktop-fullpage.png — route /use-cases, 1440x900, fullPage
// ---------------------------------------------------------------------------
test('use-cases-desktop-fullpage', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  const response = await page.goto(`${BASE}/use-cases`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  console.log(`/use-cases status: ${response?.status()}`);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'use-cases-desktop-fullpage.png'),
    fullPage: true,
  });

  await ctx.close();
});

// ---------------------------------------------------------------------------
// security-mobile-fullpage.png — route /security, 390x844, fullPage
// ---------------------------------------------------------------------------
test('security-mobile-fullpage', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  const response = await page.goto(`${BASE}/security`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  console.log(`/security status: ${response?.status()}`);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'security-mobile-fullpage.png'),
    fullPage: true,
  });

  await ctx.close();
});

// ---------------------------------------------------------------------------
// home-reduced-motion-fullpage.png — route /, 1440x900, fullPage,
//   prefers-reduced-motion: reduce (explicitly set, same as above but named)
// ---------------------------------------------------------------------------
test('home-reduced-motion-fullpage', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  const response = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  console.log(`home-reduced-motion / status: ${response?.status()}`);

  // Verify prefers-reduced-motion is active
  const prefersReducedMotion = await page.evaluate(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  console.log(`prefers-reduced-motion active: ${prefersReducedMotion}`);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'home-reduced-motion-fullpage.png'),
    fullPage: true,
  });

  await ctx.close();
});
