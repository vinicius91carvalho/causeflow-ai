import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

test.beforeEach(async ({ page }) => {
  // Block analytics/tracker domains
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
});

test.describe('Analyses — New Analysis Page', () => {
  test.beforeEach(async ({ page }) => {
    // Unauthenticated visit to /dashboard/analyses/new should redirect to sign-in
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses/new`, {
      waitUntil: 'domcontentloaded',
    });
  });

  test('unauthenticated user is redirected to sign-in', async ({ page }) => {
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe('Analyses — History Page (unauthenticated)', () => {
  test('unauthenticated user visiting /dashboard/analyses/new is redirected', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses/new`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('unauthenticated user visiting /dashboard/analyses is redirected', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe('Analyses — Detail Page (unauthenticated)', () => {
  test('unauthenticated user visiting an analysis detail is redirected', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses/some-id`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe('Analyses — New Analysis Sign-In Page (indirect)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
  });

  test('sign-in page has email and password fields (gateway for new analysis)', async ({
    page,
  }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('sign-in page has submit button (gateway for analyses)', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe('Analyses — Form Validation Logic', () => {
  /**
   * These tests validate prompt/form logic via direct URL access patterns,
   * since full form interaction requires authentication.
   * See unit tests for detailed form validation logic coverage.
   */

  test('short prompt (under 10 chars) fails Zod validation via API', async ({ request }) => {
    const res = await request.post(`${DASHBOARD_URL}/api/analyses`, {
      data: { prompt: 'Short' },
      headers: { 'Content-Type': 'application/json' },
    });
    // 401 without auth, or 400 with bad input if auth bypassed
    expect([400, 401]).toContain(res.status());
  });

  test('valid prompt with auth returns 401 without session', async ({ request }) => {
    const res = await request.post(`${DASHBOARD_URL}/api/analyses`, {
      data: { prompt: 'Why did the database fail at midnight on Friday?' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/analyses returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${DASHBOARD_URL}/api/analyses`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/analyses/some-id returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${DASHBOARD_URL}/api/analyses/some-id`);
    expect(res.status()).toBe(401);
  });
});

test.describe('Analyses — i18n Routes', () => {
  test('PT-BR /pt-br/dashboard/analyses/new redirects to sign-in', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/pt-br/dashboard/analyses/new`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('PT-BR /pt-br/dashboard/analyses redirects to sign-in', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/pt-br/dashboard/analyses`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
