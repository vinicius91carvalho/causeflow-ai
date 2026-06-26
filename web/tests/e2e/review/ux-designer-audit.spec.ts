/**
 * UX Designer Audit — Sprint 06b (REWRITE 2026-04-19)
 * Focus: visual hierarchy, color/contrast, whitespace, motion, accessibility,
 * and the user-raised concern: "too much white / light-gray background is
 * not comfortable to view".
 *
 * Pattern: session-health check + per-route content sentinel + long PRoot
 * waits (mirrors product-designer-audit.spec.ts after 2026-04-19 fix).
 *
 * Covers 3 viewports × light/dark theme × key dashboard surfaces + legal
 * pages + investigation creation flow (captures contrast of primary actions,
 * card surfaces, and text on both themes).
 *
 * Run:
 *   CLERK_SECRET_KEY=... DASHBOARD_TEST_EMAIL=vinicius@simuser.ai \
 *   SKIP_WEB_SERVER=1 DASHBOARD_URL=http://localhost:3001 \
 *   pnpm exec playwright test --project=dashboard-review \
 *     tests/e2e/review/ux-designer-audit.spec.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Page, test } from '@playwright/test';

const SCREENSHOT_DIR = path.join(
  __dirname,
  '../../../screenshots/sprint-06b-dashboard/ux-designer',
);

const BASE = process.env.DASHBOARD_URL || 'http://localhost:3001';
const WEBSITE = process.env.BASE_URL || 'http://localhost:3000';

const BLOCKED = [
  'google-analytics.com',
  'googletagmanager.com',
  'clarity.ms',
  'intercom.io',
  'c.bing.com',
];

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function gotoAndWait(
  page: Page,
  url: string,
  opts: { sentinel: string; settleMs?: number; networkIdleMs?: number } = { sentinel: 'main' },
) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const cur = new URL(page.url());
  if (cur.pathname.startsWith('/auth/') && !url.includes('/auth/')) {
    throw new Error(`SESSION_LOST: ${url} → ${cur.pathname}`);
  }
  await page.waitForSelector(opts.sentinel, { state: 'visible', timeout: 120000 });
  await page
    .waitForLoadState('networkidle', { timeout: opts.networkIdleMs ?? 20000 })
    .catch(() => {});
  await page.waitForTimeout(opts.settleMs ?? 2000);
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('causeflow-theme', t);
    } catch {}
  }, theme);
  await page.waitForTimeout(500);
}

/**
 * Pre-test session probe (same as PD audit): verify Clerk session held
 * before proceeding. Fails loud on session loss.
 */
async function probeSession(page: Page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const u = new URL(page.url());
  if (u.pathname.startsWith('/auth/')) {
    throw new Error(`SESSION_LOST at probe → ${u.pathname}`);
  }
  await page.waitForSelector('main', { state: 'visible', timeout: 120000 });
}

test.describe('UX Designer Audit — Sprint 06b', () => {
  test.use({ baseURL: BASE });

  test.beforeEach(async ({ context, page }) => {
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED.some((h) => url.includes(h))) return route.abort();
      return route.continue();
    });
    await probeSession(page);
  });

  // ── Light/Dark theme × viewport matrix on key surfaces ────────────────────
  const VIEWPORTS: { name: string; width: number; height: number }[] = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];
  const THEMES: ('light' | 'dark')[] = ['light', 'dark'];

  // 1. Dashboard Overview — PRIMARY surface for "too much white" concern
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`01-overview-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard`, {
          sentinel: '[data-testid="dashboard-overview"]',
          settleMs: 4000,
        });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        await shot(page, `01-overview-${vp.name}-${theme}`);
      });
    }
  }

  // 2. Incidents list — card surface contrast
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`02-incidents-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard/incidents`, { sentinel: 'main h1, main h2' });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        await shot(page, `02-incidents-${vp.name}-${theme}`);
      });
    }
  }

  // 3. New incident form — form fields on white/gray
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`03-new-incident-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard/incidents/new`, {
          sentinel: 'input[name="title"], input[id="incident-title"]',
        });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        await shot(page, `03-new-incident-${vp.name}-${theme}`);
      });
    }
  }

  // 4. Integrations — card grid + category filter contrast
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`04-integrations-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard/integrations`, {
          sentinel: 'main h1, main h2',
        });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        await shot(page, `04-integrations-${vp.name}-${theme}`);
      });
    }
  }

  // 5. Billing — plan cards contrast + primary CTA colors
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`05-billing-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard/billing`, { sentinel: 'main h1, main h2' });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        await shot(page, `05-billing-${vp.name}-${theme}`);
      });
    }
  }

  // 6. Settings — forms on white background
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`06-settings-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard/settings`, { sentinel: 'main h1, main h2' });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        await shot(page, `06-settings-${vp.name}-${theme}`);
      });
    }
  }

  // 7. Team — embedded Clerk OrgProfile styling divergence
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`07-team-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard/team`, { sentinel: 'main' });
        await setTheme(page, theme);
        await page.waitForTimeout(1500);
        await shot(page, `07-team-${vp.name}-${theme}`);
      });
    }
  }

  // 8. Audit trail
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`08-audit-${vp.name}-${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}/dashboard/audit`, { sentinel: 'main h1, main h2' });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        await shot(page, `08-audit-${vp.name}-${theme}`);
      });
    }
  }

  // 9. Legal pages (website, EN+PT-BR)
  test('09a-privacy-en-desktop', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: undefined,
    });
    const p = await ctx.newPage();
    await ctx.route('**/*', (r) => {
      if (BLOCKED.some((h) => r.request().url().includes(h))) return r.abort();
      return r.continue();
    });
    await p.goto(`${WEBSITE}/privacy`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForSelector('main', { state: 'visible', timeout: 60000 });
    await p.waitForTimeout(2000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await p.screenshot({
      path: path.join(SCREENSHOT_DIR, '09a-privacy-en-desktop.png'),
      fullPage: true,
    });
    await ctx.close();
  });

  test('09b-privacy-ptbr-desktop', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: undefined,
    });
    const p = await ctx.newPage();
    await ctx.route('**/*', (r) => {
      if (BLOCKED.some((h) => r.request().url().includes(h))) return r.abort();
      return r.continue();
    });
    await p.goto(`${WEBSITE}/pt-br/privacy`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForSelector('main', { state: 'visible', timeout: 60000 });
    await p.waitForTimeout(2000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await p.screenshot({
      path: path.join(SCREENSHOT_DIR, '09b-privacy-ptbr-desktop.png'),
      fullPage: true,
    });
    await ctx.close();
  });

  test('09c-terms-en-desktop', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      storageState: undefined,
    });
    const p = await ctx.newPage();
    await ctx.route('**/*', (r) => {
      if (BLOCKED.some((h) => r.request().url().includes(h))) return r.abort();
      return r.continue();
    });
    await p.goto(`${WEBSITE}/terms`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForSelector('main', { state: 'visible', timeout: 60000 });
    await p.waitForTimeout(2000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await p.screenshot({
      path: path.join(SCREENSHOT_DIR, '09c-terms-en-desktop.png'),
      fullPage: true,
    });
    await ctx.close();
  });

  test('09d-terms-ptbr-mobile', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: undefined,
    });
    const p = await ctx.newPage();
    await ctx.route('**/*', (r) => {
      if (BLOCKED.some((h) => r.request().url().includes(h))) return r.abort();
      return r.continue();
    });
    await p.goto(`${WEBSITE}/pt-br/terms`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForSelector('main', { state: 'visible', timeout: 60000 });
    await p.waitForTimeout(2000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await p.screenshot({
      path: path.join(SCREENSHOT_DIR, '09d-terms-ptbr-mobile.png'),
      fullPage: true,
    });
    await ctx.close();
  });

  // 10. Create investigation full flow — primary task flow capture
  test('10-create-investigation-flow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndWait(page, `${BASE}/dashboard/incidents/new`, {
      sentinel: 'input[name="title"], input[id="incident-title"]',
    });
    await shot(page, '10a-create-step1-empty');

    const titleField = page.locator('input[name="title"], input[id="incident-title"]').first();
    await titleField.fill('Checkout service 503 errors spiking — payment flow impacted');

    const descField = page
      .locator('textarea[name="description"], textarea[id="incident-description"]')
      .first();
    if (await descField.isVisible().catch(() => false)) {
      await descField.fill(
        'Starting at 14:32 UTC, the checkout service began returning 503 errors at ~15% rate. Payment processing flow affected. Correlates with a recent deployment of the payment-gateway service v2.4.1 at 14:28 UTC.',
      );
    }

    const criticalBtn = page
      .locator('button, label')
      .filter({ hasText: /critical/i })
      .first();
    if (await criticalBtn.isVisible().catch(() => false)) await criticalBtn.click();

    await shot(page, '10b-create-step2-filled');

    const submitBtn = page
      .locator('button[type="submit"]')
      .filter({ hasText: /create|submit|start|investigate/i })
      .first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(8000);
      await shot(page, '10c-create-step3-post-submit');

      if (page.url().includes('/incidents/')) {
        await page.waitForSelector('main', { state: 'visible', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(5000);
        await shot(page, '10d-investigation-detail-top');

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(1500);
        await shot(page, '10e-investigation-detail-mid');

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        await shot(page, '10f-investigation-detail-bottom');
      }
    }
  });

  // 11. Color palette probe — capture computed background colors on each page
  // Saves a JSON sidecar with background-color of body, main, cards, inputs
  // for objective reference in the audit writeup.
  test('11-color-palette-probe', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const routes = [
      '/dashboard',
      '/dashboard/incidents',
      '/dashboard/integrations',
      '/dashboard/billing',
      '/dashboard/settings',
    ];
    const palette: Record<string, Record<string, Record<string, string>>> = {};
    for (const theme of THEMES) {
      palette[theme] = {};
      for (const route of routes) {
        await setTheme(page, theme);
        await gotoAndWait(page, `${BASE}${route}`, { sentinel: 'main' });
        await setTheme(page, theme);
        await page.waitForTimeout(1000);
        const sample = await page.evaluate(() => {
          const out: Record<string, string> = {};
          const capture = (label: string, el: Element | null) => {
            if (!el) return;
            const cs = getComputedStyle(el);
            out[`${label}-bg`] = cs.backgroundColor;
            out[`${label}-fg`] = cs.color;
          };
          capture('body', document.body);
          capture('main', document.querySelector('main'));
          capture('card', document.querySelector('[data-slot="card"], .card, .rounded-lg.border'));
          capture('input', document.querySelector('input'));
          capture(
            'primary-btn',
            document.querySelector('button.bg-primary, [data-testid="cta-new-analysis"]'),
          );
          return out;
        });
        palette[theme][route] = sample;
      }
    }
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, '11-color-palette.json'),
      JSON.stringify(palette, null, 2),
    );
  });
});
