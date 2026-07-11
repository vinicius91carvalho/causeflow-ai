import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';

// --- Locale Configuration ---
// Default: English only. Set TEST_LOCALES=en,pt-br to test both locales.
const TEST_LOCALES = (process.env.TEST_LOCALES || 'en').split(',').map((l) => l.trim());

const pages = [
  { route: '/', name: 'homepage', hasJsonLd: true },
  { route: '/product', name: 'product', hasJsonLd: true },
  { route: '/pricing', name: 'pricing' },
  { route: '/security', name: 'security' },
  { route: '/integrations', name: 'integrations' },
  { route: '/about', name: 'about' },
  { route: '/use-cases', name: 'use-cases-index' },
  { route: '/use-cases/stale-pricing', name: 'case-stale-pricing' },
  { route: '/use-cases/broken-images', name: 'case-broken-images' },
  { route: '/use-cases/cascading-500', name: 'case-cascading-500' },
  { route: '/privacy', name: 'privacy' },
  { route: '/terms', name: 'terms' },
];

const localeConfig: Record<string, { prefix: string; label: string }> = {
  en: { prefix: '', label: 'en' },
  'pt-br': { prefix: '/pt-br', label: 'pt-br' },
};

const viewportNames: Record<string, string> = {
  'chromium-mobile': 'mobile-375x812',
  'chromium-tablet': 'tablet-768x1024',
  'chromium-desktop': 'desktop-1280x800',
  'chromium-wide': 'wide-1440x900',
};

// --- Domains to block (analytics, trackers, third-party widgets) ---
const BLOCKED_PATTERNS = [
  'google-analytics.com',
  'googletagmanager.com',
  'analytics.google.com',
  'clarity.ms',
  'www.clarity.ms',
  'intercom.io',
  'widget.intercom.io',
  'facebook.net',
  'connect.facebook.net',
  'doubleclick.net',
  'googlesyndication.com',
  'adservice.google.com',
  'cdn.segment.com',
  'sentry.io',
];

function shouldBlock(url: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => url.includes(pattern));
}

// --- Network Interception: block trackers/analytics ---
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (shouldBlock(url)) {
      return route.abort();
    }
    return route.continue();
  });
});

// --- Consolidated Per-Page Audit (SEO + A11y + Visual in ONE navigation) ---
for (const localeKey of TEST_LOCALES) {
  const locale = localeConfig[localeKey];
  if (!locale) continue;

  for (const pageInfo of pages) {
    const fullRoute = `${locale.prefix}${pageInfo.route}`;
    const testName = `${locale.label}/${pageInfo.name}`;

    test(`audit: ${testName}`, async ({ page: browserPage }, testInfo) => {
      const projectName = testInfo.project.name;
      const viewportLabel = viewportNames[projectName] || projectName;

      // Track console errors (ignore blocked resource failures from route.abort())
      const consoleErrors: { type: string; text: string }[] = [];
      browserPage.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          const isBlockedResource =
            text.includes('net::ERR_FAILED') || text.includes('net::ERR_ABORTED');
          if (!isBlockedResource) {
            consoleErrors.push({ type: msg.type(), text });
          }
        }
      });

      // ========== 1. NAVIGATE ONCE ==========
      const response = await browserPage.goto(fullRoute, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      expect(response).not.toBeNull();
      expect(response?.status()).toBeLessThan(400);

      // Web-first assertion: wait for main content instead of hardcoded timeout
      await expect(browserPage.locator('main')).toBeVisible({ timeout: 10000 });

      // ========== 2. SEO ASSERTIONS ==========
      // Title
      const title = await browserPage.title();
      expect(title.length, `${testName}: title should not be empty`).toBeGreaterThan(0);
      expect(title.length, `${testName}: title should be <= 70 chars`).toBeLessThanOrEqual(70);

      // Meta description
      const metaDesc = await browserPage
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(metaDesc, `${testName}: meta description missing`).toBeTruthy();
      expect(metaDesc?.length, `${testName}: meta desc should be <= 200 chars`).toBeLessThanOrEqual(
        200,
      );

      // Canonical URL
      const canonical = await browserPage.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `${testName}: canonical link missing`).toBeTruthy();

      // OG tags
      const ogTitle = await browserPage
        .locator('meta[property="og:title"]')
        .getAttribute('content');
      expect(ogTitle, `${testName}: og:title missing`).toBeTruthy();
      const ogDesc = await browserPage
        .locator('meta[property="og:description"]')
        .getAttribute('content');
      expect(ogDesc, `${testName}: og:description missing`).toBeTruthy();

      // Viewport meta
      const viewport = await browserPage.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport, `${testName}: viewport meta missing`).toBeTruthy();
      expect(viewport).toContain('width=device-width');

      // Heading hierarchy
      const h1Count = await browserPage.locator('h1').count();
      expect(h1Count, `${testName}: should have exactly 1 h1`).toBe(1);
      const h1Text = await browserPage.locator('h1').first().textContent();
      expect(h1Text?.trim().length, `${testName}: h1 should not be empty`).toBeGreaterThan(0);

      // Hreflang tags
      const enHreflang = await browserPage.locator('link[hreflang="en"]').count();
      const ptHreflang = await browserPage.locator('link[hreflang="pt-br"]').count();
      expect(enHreflang, `${testName}: en hreflang missing`).toBeGreaterThanOrEqual(1);
      expect(ptHreflang, `${testName}: pt-br hreflang missing`).toBeGreaterThanOrEqual(1);

      // Structured data (only for pages known to have it)
      if (pageInfo.hasJsonLd) {
        const jsonLd = await browserPage.locator('script[type="application/ld+json"]').count();
        expect(jsonLd, `${testName}: should have JSON-LD structured data`).toBeGreaterThanOrEqual(
          1,
        );
      }

      // ========== 3. ACCESSIBILITY ASSERTIONS ==========
      // Lang attribute
      const lang = await browserPage.locator('html').getAttribute('lang');
      expect(lang, `${testName}: html lang attribute missing`).toBeTruthy();

      // Images have alt text
      const images = await browserPage.locator('img').all();
      for (let i = 0; i < images.length; i++) {
        const alt = await images[i].getAttribute('alt');
        expect(alt !== null, `${testName}: img[${i}] missing alt attribute`).toBe(true);
      }

      // Links are accessible
      const links = await browserPage.locator('a').all();
      for (let i = 0; i < links.length; i++) {
        const text = await links[i].textContent();
        const ariaLabel = await links[i].getAttribute('aria-label');
        const hasChildWithAlt = await links[i].locator('img[alt]').count();
        const srOnly = await links[i].locator('.sr-only').count();
        const isAccessible =
          (text?.trim().length ?? 0) > 0 || ariaLabel !== null || hasChildWithAlt > 0 || srOnly > 0;
        expect(isAccessible, `${testName}: link[${i}] has no accessible name`).toBe(true);
      }

      // Main landmark
      const mainCount = await browserPage.locator('main').count();
      expect(mainCount, `${testName}: should have a <main> landmark`).toBeGreaterThanOrEqual(1);

      // ========== 4. VISUAL SCREENSHOT ==========
      const screenshotDir = path.join('screenshots', locale.label);
      fs.mkdirSync(screenshotDir, { recursive: true });
      await browserPage.screenshot({
        path: path.join(screenshotDir, `${pageInfo.name}-${viewportLabel}.png`),
        fullPage: true,
      });

      // ========== 5. CONSOLE ERROR CHECK ==========
      expect(consoleErrors, `Console errors on ${fullRoute} (${viewportLabel})`).toHaveLength(0);
    });
  }
}

// --- Infrastructure Checks (singleton tests, not per-page) ---
test.describe('Infrastructure', () => {
  test('robots.txt is accessible', async ({ request }, testInfo) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('User-Agent');
    const baseURL = testInfo.project.use.baseURL || process.env.BASE_URL || 'http://127.0.0.1:3000';
    if (!baseURL.includes('staging.')) {
      expect(text).toContain('Sitemap');
    }
  });

  test('sitemap.xml is accessible', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('urlset');
    expect(text).toContain('causeflow.ai');
  });

  test('Homepage has security headers', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('Homepage loads within performance budget', async ({ page: browserPage }) => {
    const start = Date.now();
    await browserPage.goto('/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    // PRoot/ARM64 emulation adds overhead; use 5s locally, 3s in CI
    const budget = process.env.CI ? 3000 : 5000;
    expect(loadTime, `Homepage DOMContentLoaded took ${loadTime}ms`).toBeLessThan(budget);
  });

  test('JS bundle size is under target', async ({ page: browserPage }) => {
    await browserPage.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(browserPage.locator('main')).toBeVisible();
    const scripts = await browserPage.locator('script[src*="/_next/"]').all();
    expect(scripts.length, 'Too many JS chunks loaded').toBeLessThan(20);
  });

  test('CSS is loaded', async ({ page: browserPage }) => {
    await browserPage.goto('/', { waitUntil: 'domcontentloaded' });
    const stylesheets = await browserPage.locator('link[rel="stylesheet"]').count();
    expect(stylesheets, 'Should have at least 1 stylesheet').toBeGreaterThanOrEqual(1);
  });
});
