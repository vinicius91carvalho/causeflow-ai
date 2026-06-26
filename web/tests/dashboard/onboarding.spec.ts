import { expect, test } from '@playwright/test';
import { setTestSession } from './helpers/create-test-session';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

test.beforeEach(async ({ page }) => {
  // Block analytics/tracker domains
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
});

test.describe('Onboarding — Middleware Redirects', () => {
  test('unauthenticated user visiting /onboarding/complete-profile is redirected to sign-in', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/onboarding/complete-profile`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe('Onboarding — Complete Profile Page', () => {
  test.beforeEach(async ({ page, context }) => {
    await setTestSession(context, { profileComplete: false });
    await page.goto(`${DASHBOARD_URL}/onboarding/complete-profile`, {
      waitUntil: 'domcontentloaded',
    });
  });

  test('complete-profile page renders with heading', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('complete-profile page has company name input', async ({ page }) => {
    await expect(page.locator('input[id="company-name"]')).toBeVisible();
  });

  test('complete-profile page has company website input', async ({ page }) => {
    await expect(page.locator('input[id="company-website"]')).toBeVisible();
  });

  test('complete-profile page has team size selector', async ({ page }) => {
    await expect(page.locator('select[id="team-size"]')).toBeVisible();
  });

  test('complete-profile page has role input', async ({ page }) => {
    await expect(page.locator('input[id="role"]')).toBeVisible();
  });

  test('complete-profile page has Continue submit button', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('complete-profile page has terms acceptance checkbox', async ({ page }) => {
    await expect(page.locator('input[id="accept-terms"]')).toBeVisible();
  });

  test('complete-profile page terms checkbox has link to terms page', async ({ page }) => {
    const termsLink = page.locator(
      'label[for="accept-terms"] a[href="https://causeflow.ai/terms"]',
    );
    await expect(termsLink).toBeVisible();
    await expect(termsLink).toHaveAttribute('target', '_blank');
  });

  test('form validation — empty company name shows error on submit', async ({ page }) => {
    // Select a team size but leave company name empty
    await page.selectOption('select[id="team-size"]', '1_5');
    await page.click('button[type="submit"]');
    // Error message should appear
    const errorEl = page.locator('[role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 3000 });
  });

  test('form validation — unchecked terms acceptance shows error on submit', async ({ page }) => {
    // Wait for form hydration
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    await page.locator('input[id="company-name"]').pressSequentially('Acme Corp');
    await page.selectOption('select[id="team-size"]', '1_5');
    // Do NOT check the terms checkbox
    await page.click('button[type="submit"]');
    const errorEl = page.locator('[role="alert"]').filter({ hasText: /terms|Termos/i });
    await expect(errorEl).toBeVisible({ timeout: 3000 });
  });

  test('form validation — invalid website URL shows error', async ({ page }) => {
    await page.locator('input[id="company-name"]').pressSequentially('Acme Corp');
    await page.locator('input[id="company-website"]').pressSequentially('not-a-url');
    await page.selectOption('select[id="team-size"]', '6_20');
    await page.click('button[type="submit"]');
    const errorEl = page.locator('[role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 3000 });
  });

  test('complete-profile page has CauseFlow logo', async ({ page }) => {
    await expect(page.locator('img[alt="CauseFlow AI"]').first()).toBeVisible();
  });
});

test.describe('Onboarding — Dark Mode', () => {
  test('complete-profile page renders in dark mode', async ({ page, context }) => {
    await setTestSession(context, { profileComplete: false });

    await page.goto(`${DASHBOARD_URL}/onboarding/complete-profile`, {
      waitUntil: 'domcontentloaded',
    });
    await page.evaluate(() => {
      localStorage.setItem(
        'causeflow-theme',
        JSON.stringify({ themeId: 'default', colorMode: 'dark' }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });
});

// ---------------------------------------------------------------------------
// Complete Profile Form Submission
// ---------------------------------------------------------------------------

test.describe('Onboarding — Complete Profile Form Submission', () => {
  test.beforeEach(async ({ page, context }) => {
    await setTestSession(context, { profileComplete: false });

    await page.goto(`${DASHBOARD_URL}/onboarding/complete-profile`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for React hydration before interacting with form
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  /** Fill the form using click + pressSequentially to ensure React state updates */
  async function fillInput(page: import('@playwright/test').Page, id: string, value: string) {
    const input = page.locator(`input[id="${id}"]`);
    await input.click();
    await input.pressSequentially(value, { delay: 20 });
  }

  test('successful submission navigates to dashboard', async ({ page }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tenantId: 'tenant-abc123',
          companyName: 'Acme Corp',
        }),
      });
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await fillInput(page, 'company-website', 'https://acme.com');
    await page.selectOption('select[id="team-size"]', '6_20');
    await fillInput(page, 'role', 'SRE Lead');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
  });

  test('successful submission with only required fields navigates to dashboard', async ({
    page,
  }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tenantId: 'tenant-xyz789',
          companyName: 'StartupCo',
        }),
      });
    });

    await fillInput(page, 'company-name', 'StartupCo');
    await page.selectOption('select[id="team-size"]', '1_5');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
  });

  test('API 500 error shows global error message', async ({ page }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await page.selectOption('select[id="team-size"]', '6_20');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    const globalError = page.locator('[role="alert"]').filter({ hasText: /Internal server error/ });
    await expect(globalError).toBeVisible({ timeout: 5000 });
  });

  test('API 400 validation error shows global error message', async ({ page }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Company name must be at least 2 characters' }),
      });
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await page.selectOption('select[id="team-size"]', '21_50');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    const globalError = page.locator('[role="alert"]').filter({ hasText: /at least 2 characters/ });
    await expect(globalError).toBeVisible({ timeout: 5000 });
  });

  test('API 429 rate limit error shows global error message', async ({ page }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
      });
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await page.selectOption('select[id="team-size"]', '1_5');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    const globalError = page.locator('[role="alert"]').filter({ hasText: /Too many attempts/ });
    await expect(globalError).toBeVisible({ timeout: 5000 });
  });

  test('submit button shows loading spinner during submission', async ({ page }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, tenantId: 'tenant-abc', companyName: 'Acme' }),
      });
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await page.selectOption('select[id="team-size"]', '6_20');
    await page.check('input[id="accept-terms"]');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await expect(submitBtn).toBeDisabled({ timeout: 2000 });
  });

  test('form inputs are disabled while submitting', async ({ page }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, tenantId: 'tenant-abc', companyName: 'Acme' }),
      });
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await page.selectOption('select[id="team-size"]', '6_20');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    await expect(page.locator('input[id="company-name"]')).toBeDisabled({ timeout: 2000 });
    await expect(page.locator('input[id="company-website"]')).toBeDisabled({ timeout: 2000 });
    await expect(page.locator('select[id="team-size"]')).toBeDisabled({ timeout: 2000 });
  });

  test('form validation — empty team size shows error on submit', async ({ page }) => {
    await fillInput(page, 'company-name', 'Acme Corp');
    await page.click('button[type="submit"]');

    const errorEl = page.locator('[role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 3000 });
  });

  test('network failure shows fallback error message', async ({ page }) => {
    await page.route('**/api/onboarding/complete-profile', async (route) => {
      await route.abort('failed');
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await page.selectOption('select[id="team-size"]', '1_5');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    const globalError = page
      .locator('[role="alert"]')
      .filter({ hasText: /went wrong|deu errado/i });
    await expect(globalError).toBeVisible({ timeout: 5000 });
  });

  test('POST request is sent with correct JSON body', async ({ page }) => {
    let capturedBody: unknown = null;

    await page.route('**/api/onboarding/complete-profile', async (route) => {
      capturedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, tenantId: 'tenant-abc', companyName: 'Acme Corp' }),
      });
    });

    await fillInput(page, 'company-name', 'Acme Corp');
    await fillInput(page, 'company-website', 'https://acme.com');
    await page.selectOption('select[id="team-size"]', '6_20');
    await fillInput(page, 'role', 'SRE Lead');
    await page.check('input[id="accept-terms"]');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });

    expect(capturedBody).toMatchObject({
      companyName: 'Acme Corp',
      companyWebsite: 'https://acme.com',
      teamSize: '6_20',
      role: 'SRE Lead',
      acceptTerms: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Responsive Layout
// ---------------------------------------------------------------------------

test.describe('Onboarding — Responsive Layout', () => {
  test.beforeEach(async ({ context }) => {
    await setTestSession(context, { profileComplete: false });
  });

  test('complete-profile page renders correctly on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${DASHBOARD_URL}/onboarding/complete-profile`, {
      waitUntil: 'domcontentloaded',
    });

    // Key elements must still be visible at mobile width
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[id="company-name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('complete-profile page renders correctly on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${DASHBOARD_URL}/onboarding/complete-profile`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[id="company-name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('complete-profile page renders correctly on desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${DASHBOARD_URL}/onboarding/complete-profile`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
