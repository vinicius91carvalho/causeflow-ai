/**
 * Playwright E2E tests — Billing page and API endpoints.
 *
 * Scope:
 * - Billing page rendering (plan cards, credits section, page heading)
 * - Sidebar navigation to billing
 * - Webhook API security (signature enforcement)
 * - Subscription API authentication (requires session)
 * - RBAC enforcement on billing endpoints
 *
 * What is NOT tested here:
 * - Real Stripe Checkout redirect (requires live Stripe API keys)
 * - Real Stripe Customer Portal redirect (requires live keys + customer)
 * - Webhook event processing (covered by Vitest unit tests)
 *
 * Auth: tests run inside `dashboard-authed` project which pre-loads
 *   `tests/dashboard/.auth/user.json` (signed in as test@example.com, role=admin).
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

// ---------------------------------------------------------------------------
// Billing Page — Rendering
// ---------------------------------------------------------------------------

test.describe('Billing Page — Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    // Mock subscription API to avoid needing real Stripe
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'free',
          subscriptionStatus: null,
          creditsTotal: 5,
          creditsUsed: 2,
          creditsRemaining: 3,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: false,
        }),
      }),
    );
  });

  test('billing page loads and shows a heading containing "Billing" or "Plan"', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // The page heading is an h2 inside the billing route
    const heading = page.locator('h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    const headingText = (await heading.textContent()) ?? '';
    expect(
      headingText.toLowerCase().includes('billing') || headingText.toLowerCase().includes('plan'),
    ).toBe(true);
  });

  test('billing page shows exactly 5 plan cards (Free, Starter, Pro, Business, Enterprise)', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Plan cards are <article> elements with aria-label="<name> plan"
    const planCards = page.locator('article[aria-label$=" plan"]');
    await expect(planCards).toHaveCount(5, { timeout: 10000 });
  });

  test('Enterprise card shows "Contact Sales" CTA', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    const enterpriseCard = page.locator('article[aria-label="Enterprise plan"]');
    await expect(enterpriseCard).toBeVisible({ timeout: 10000 });

    // Enterprise uses a mailto link, not a button
    const contactLink = enterpriseCard.locator('a[href^="mailto:"]');
    await expect(contactLink).toBeVisible();
    const linkText = (await contactLink.textContent()) ?? '';
    expect(linkText.toLowerCase()).toContain('contact');
  });

  test('Free plan card shows "Current Plan" indicator', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    const freeCard = page.locator('article[aria-label="Free plan"]');
    await expect(freeCard).toBeVisible({ timeout: 10000 });

    // "Current plan" badge or "Current Plan" button text
    await expect(freeCard.locator('text=/[Cc]urrent [Pp]lan/')).toBeVisible();
  });

  test('credits section is visible with progress bar', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Credits status section
    const creditsSection = page.locator('section[aria-label="Credits status"]');
    await expect(creditsSection).toBeVisible({ timeout: 10000 });

    // Progress bar is inside credits section
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible({ timeout: 10000 });
    await expect(progressBar).toHaveAttribute('aria-valuemax', '5');
    await expect(progressBar).toHaveAttribute('aria-valuenow', '3');
  });

  test('credits used / total text is displayed', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    // creditsUsed=2, creditsTotal=5 → "2 / 5 used"
    await expect(page.locator('text=2 / 5 used')).toBeVisible({ timeout: 10000 });
  });

  test('page renders correctly in dark mode', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Switch to dark mode via theme toggle in header
    const themeToggle = page.locator('header').locator('button[title^="Theme:"]');
    await themeToggle.click();

    // Page content should still be functional
    await expect(page.locator('article[aria-label$=" plan"]').first()).toBeVisible();
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });
});

// ---------------------------------------------------------------------------
// Billing Page — Warning & Critical States
// ---------------------------------------------------------------------------

test.describe('Billing Page — Credits Warning and Critical States', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('shows warning state when < 20% credits remain', async ({ page }) => {
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'starter',
          subscriptionStatus: 'active',
          creditsTotal: 100,
          creditsUsed: 82,
          creditsRemaining: 18,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: true,
        }),
      }),
    );

    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Warning state has amber border
    const creditsSection = page.locator('section[aria-label="Credits status"]');
    await expect(creditsSection).toBeVisible({ timeout: 10000 });
    await expect(creditsSection).toHaveClass(/border-amber/, { timeout: 10000 });
  });

  test('shows critical state when < 5% credits remain', async ({ page }) => {
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'pro',
          subscriptionStatus: 'active',
          creditsTotal: 100,
          creditsUsed: 97,
          creditsRemaining: 3,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: true,
        }),
      }),
    );

    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Critical state has red border
    const creditsSection = page.locator('section[aria-label="Credits status"]');
    await expect(creditsSection).toBeVisible({ timeout: 10000 });
    await expect(creditsSection).toHaveClass(/border-red/, { timeout: 10000 });
  });

  test('shows canceling status alert for canceling subscription', async ({ page }) => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'pro',
          subscriptionStatus: 'canceling',
          creditsTotal: 100,
          creditsUsed: 10,
          creditsRemaining: 90,
          currentPeriodEnd: futureDate,
          cancelAtPeriodEnd: true,
          hasStripeCustomer: true,
        }),
      }),
    );

    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Status alert should appear
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10000 });
    // Alert should have amber styles (canceling state)
    await expect(alert).toHaveClass(/border-amber/, { timeout: 10000 });
  });

  test('shows Manage Subscription button when hasStripeCustomer is true', async ({ page }) => {
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'pro',
          subscriptionStatus: 'active',
          creditsTotal: 100,
          creditsUsed: 10,
          creditsRemaining: 90,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
          hasStripeCustomer: true,
        }),
      }),
    );

    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // "Manage Subscription" button appears when hasStripeCustomer=true
    const manageBtn = page.locator('button:has-text("Manage")');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
  });

  test('does NOT show Manage Subscription button when hasStripeCustomer is false', async ({
    page,
  }) => {
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'free',
          subscriptionStatus: null,
          creditsTotal: 5,
          creditsUsed: 0,
          creditsRemaining: 5,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: false,
        }),
      }),
    );

    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('article[aria-label$=" plan"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Manage Subscription button should NOT be visible
    await expect(page.locator('button:has-text("Manage")')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Billing Page — Sidebar Navigation
// ---------------------------------------------------------------------------

test.describe('Billing — Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'free',
          subscriptionStatus: null,
          creditsTotal: 5,
          creditsUsed: 0,
          creditsRemaining: 5,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: false,
        }),
      }),
    );
  });

  test('billing link is present in sidebar', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar.locator('a[href="/dashboard/billing"]')).toBeVisible();
  });

  test('clicking billing link in sidebar navigates to /dashboard/billing', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await sidebar.locator('a[href="/dashboard/billing"]').click();
    await expect(page).toHaveURL(/\/dashboard\/billing/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('billing nav item has aria-current="page" when on billing page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    const billingLink = sidebar.locator('a[href="/dashboard/billing"][aria-current="page"]');
    await expect(billingLink).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Webhook API — Security (no auth required, but signature must be valid)
// ---------------------------------------------------------------------------

test.describe('Billing API — Webhook Security', () => {
  test('POST /api/billing/webhook without stripe-signature header returns 400', async ({
    request,
  }) => {
    const response = await request.post(`${DASHBOARD_URL}/api/billing/webhook`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain('stripe-signature');
  });

  test('POST /api/billing/webhook with invalid stripe-signature returns 400', async ({
    request,
  }) => {
    const response = await request.post(`${DASHBOARD_URL}/api/billing/webhook`, {
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=invalid,v1=fake_signature',
      },
      data: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toMatch(/signature|Invalid/i);
  });

  test('POST /api/billing/webhook with empty body and invalid signature returns 400', async ({
    request,
  }) => {
    const response = await request.post(`${DASHBOARD_URL}/api/billing/webhook`, {
      headers: {
        'Content-Type': 'text/plain',
        'stripe-signature': 't=1,v1=fakesig',
      },
      data: '',
    });
    // Should fail signature verification since STRIPE_WEBHOOK_SECRET is not configured
    expect([400, 500]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// Billing API — Authentication & RBAC
// ---------------------------------------------------------------------------

test.describe('Billing API — Authentication (Unauthenticated Requests)', () => {
  test('GET /api/billing/subscription without session returns 401 or 403', async ({ request }) => {
    // This uses a fresh request context with NO auth cookies
    const response = await request.get(`${DASHBOARD_URL}/api/billing/subscription`);
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/billing/checkout without session returns 401 or 403', async ({ request }) => {
    const response = await request.post(`${DASHBOARD_URL}/api/billing/checkout`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ planId: 'pro' }),
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/billing/portal without session returns 401 or 403', async ({ request }) => {
    const response = await request.post(`${DASHBOARD_URL}/api/billing/portal`, {
      headers: { 'Content-Type': 'application/json' },
      data: '',
    });
    expect([401, 403]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// Billing API — Authenticated Requests (admin user from auth-setup)
// ---------------------------------------------------------------------------

test.describe('Billing API — Authenticated Subscription Endpoint', () => {
  test('GET /api/billing/subscription returns valid subscription data for authenticated admin', async ({
    page,
    request,
  }) => {
    // Navigate to load the session, then use request context (which inherits page cookies)
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

    const response = await request.get(`${DASHBOARD_URL}/api/billing/subscription`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      plan: string;
      creditsTotal: number;
      creditsUsed: number;
      creditsRemaining: number;
      cancelAtPeriodEnd: boolean;
      hasStripeCustomer: boolean;
    };

    // Response should have expected shape
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('creditsTotal');
    expect(body).toHaveProperty('creditsUsed');
    expect(body).toHaveProperty('creditsRemaining');
    expect(typeof body.cancelAtPeriodEnd).toBe('boolean');
    expect(typeof body.hasStripeCustomer).toBe('boolean');

    // creditsRemaining should equal creditsTotal - creditsUsed
    expect(body.creditsRemaining).toBe(Math.max(0, body.creditsTotal - body.creditsUsed));
  });
});

// ---------------------------------------------------------------------------
// Plan Cards — Interaction
// ---------------------------------------------------------------------------

test.describe('Billing Page — Plan Card Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
    await page.route('**/api/billing/subscription', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'free',
          subscriptionStatus: null,
          creditsTotal: 5,
          creditsUsed: 0,
          creditsRemaining: 5,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: false,
        }),
      }),
    );
  });

  test('clicking Upgrade on Starter plan triggers checkout API call', async ({ page }) => {
    // Intercept the checkout API — return error so we don't redirect
    let checkoutCalled = false;
    await page.route('**/api/billing/checkout', (route) => {
      checkoutCalled = true;
      void route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Stripe not configured in test environment' }),
      });
    });

    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Wait for plan cards to load
    const starterCard = page.locator('article[aria-label="Starter plan"]');
    await expect(starterCard).toBeVisible({ timeout: 10000 });

    // Click the Upgrade button on Starter plan
    const upgradeBtn = starterCard.locator('button:not([disabled])');
    await upgradeBtn.click();

    // Verify the checkout API was called
    await expect.poll(() => checkoutCalled, { timeout: 5000 }).toBe(true);
  });

  test('Pro plan card has highlighted styling (popular plan)', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    const proCard = page.locator('article[aria-label="Pro plan"]');
    await expect(proCard).toBeVisible({ timeout: 10000 });

    // Pro card has emerald highlight styles when not the current plan
    const cardClass = await proCard.getAttribute('class');
    expect(cardClass).toContain('emerald');
  });

  test('all plan card feature lists are visible', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // Each plan card has a features <ul>
    const featureLists = page.locator('ul[aria-label$=" features"]');
    await expect(featureLists).toHaveCount(5, { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Billing Page — Loading Skeleton
// ---------------------------------------------------------------------------

test.describe('Billing Page — Loading State', () => {
  test('skeleton cards appear while subscription data is loading', async ({ page }) => {
    await blockTrackers(page);

    // Delay the subscription response to observe skeleton state
    await page.route('**/api/billing/subscription', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'free',
          subscriptionStatus: null,
          creditsTotal: 5,
          creditsUsed: 0,
          creditsRemaining: 5,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasStripeCustomer: false,
        }),
      });
    });

    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toBeVisible();

    // During loading, skeleton cards have animate-pulse
    const skeletons = page.locator('[aria-hidden="true"].animate-pulse');
    await expect(skeletons.first()).toBeVisible({ timeout: 5000 });
  });
});
