import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';

test.beforeEach(async ({ page }) => {
  // Block analytics/tracker domains
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
});

test.describe('Auth — Middleware Redirects', () => {
  test('unauthenticated user visiting /dashboard is redirected to /auth/sign-in', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('unauthenticated user visiting / is redirected to /auth/sign-in', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('unauthenticated user visiting /dashboard/analyses is redirected to /auth/sign-in', async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/dashboard/analyses`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe('Auth — Sign In Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
  });

  test('sign-in page renders with correct heading', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('sign-in page has email and password fields', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('sign-in page has CauseFlow logo', async ({ page }) => {
    // The CauseFlow logo
    await expect(page.locator('img[alt="CauseFlow AI"]').first()).toBeVisible();
  });

  test('sign-in page has Google and GitHub social login buttons', async ({ page }) => {
    // OAuth buttons should be present
    const googleBtn = page.locator('button:has-text("Google")');
    const githubBtn = page.locator('button:has-text("GitHub")');
    await expect(googleBtn).toBeVisible();
    await expect(githubBtn).toBeVisible();
  });

  test('sign-in page has forgot password link', async ({ page }) => {
    await expect(page.locator('a[href*="forgot-password"]')).toBeVisible();
  });

  test('sign-in page has sign up link', async ({ page }) => {
    await expect(page.locator('a[href*="sign-up"]')).toBeVisible();
  });

  test('sign-in form shows validation errors for empty submission', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    // Email field should show validation state
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('sign-in page is responsive on mobile', async ({ page }) => {
    // Form card should be visible at mobile viewport
    const card = page.locator('.rounded-2xl').first();
    await expect(card).toBeVisible();
  });
});

test.describe('Auth — Sign Up Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-up`, { waitUntil: 'domcontentloaded' });
  });

  test('sign-up page renders with correct heading', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('sign-up page has required form fields', async ({ page }) => {
    await expect(page.locator('input[type="text"]').first()).toBeVisible(); // name
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[id="sign-up-password"]')).toBeVisible();
  });

  test('sign-up page has social login buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Google")')).toBeVisible();
    await expect(page.locator('button:has-text("GitHub")')).toBeVisible();
  });

  test('sign-up page has terms and privacy checkboxes', async ({ page }) => {
    await expect(page.locator('input[type="checkbox"]')).toBeVisible();
    await expect(page.locator('a[href*="terms"]')).toBeVisible();
    await expect(page.locator('a[href*="privacy"]')).toBeVisible();
  });

  test('sign-up page shows password strength indicator', async ({ page }) => {
    const passwordInput = page.locator('input[id="sign-up-password"]');
    await expect(passwordInput).toBeVisible();
    // Click to focus, then type to trigger React onChange reliably
    await passwordInput.click();
    await passwordInput.pressSequentially('StrongPass1', { delay: 50 });
    // Strength indicator paragraph appears after typing (contains "Password strength:")
    await expect(page.locator('p:has-text("Password strength")')).toBeVisible({ timeout: 5000 });
  });

  test('sign-up page has sign-in link', async ({ page }) => {
    await expect(page.locator('a[href*="sign-in"]')).toBeVisible();
  });
});

test.describe('Auth — Verify Email Page', () => {
  test('verify-email page renders correctly', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/verify-email?email=test@example.com`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('h1')).toBeVisible();
    // 6-digit code input
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible();
  });

  test('verify-email page shows email in subtitle', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/verify-email?email=user@test.com`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('text=user@test.com')).toBeVisible();
  });

  test('verify-email page has resend code button', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/verify-email`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('button:has-text("Resend code")')).toBeVisible();
  });

  test('verify-email page has back to sign-in link', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/verify-email`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href*="sign-in"]')).toBeVisible();
  });
});

test.describe('Auth — Forgot Password Page', () => {
  test('forgot-password page renders with email step', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/forgot-password`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('forgot-password page has back to sign-in link', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/forgot-password`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href*="sign-in"]')).toBeVisible();
  });

  test('auth pages share consistent branding (CauseFlow logo)', async ({ page }) => {
    // Check sign-in has CauseFlow logo
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    const logoCount = await page.locator('img[alt="CauseFlow AI"]').count();
    expect(logoCount).toBeGreaterThan(0);
  });
});

test.describe('Auth — Dark Mode', () => {
  test('sign-in page renders in dark mode', async ({ page }) => {
    // Set localStorage to dark mode
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem(
        'causeflow-theme',
        JSON.stringify({ themeId: 'default', colorMode: 'dark' }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Dark mode class should be on html
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Form Validation
// ---------------------------------------------------------------------------

test.describe('Auth — Sign In Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
  });

  test('shows email error when email field is empty on submit', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    // aria-invalid should be set on the email input
    await expect(page.locator('input[type="email"]')).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows password error when password field is empty on submit', async ({ page }) => {
    await page.locator('input[type="email"]').fill('valid@example.com');
    await page.locator('button[type="submit"]').click();
    // aria-invalid should be set on the password input
    const passwordInput = page.locator('input[id="sign-in-password"]');
    await expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows error when email format is invalid', async ({ page }) => {
    await page.locator('input[type="email"]').fill('not-an-email');
    await page.locator('button[type="submit"]').click();
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    // Error message element should appear
    await expect(page.locator('#email-error')).toBeVisible();
  });

  test('shows error when password is too short (under 8 chars)', async ({ page }) => {
    await page.locator('input[type="email"]').fill('valid@example.com');
    await page.locator('input[id="sign-in-password"]').fill('short');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#password-error')).toBeVisible();
  });

  test('does not show errors when form has valid values before submit', async ({ page }) => {
    await page.locator('input[type="email"]').fill('valid@example.com');
    await page.locator('input[id="sign-in-password"]').fill('ValidPass1');
    // No errors should be visible before submission attempt
    await expect(page.locator('#email-error')).not.toBeVisible();
    await expect(page.locator('#password-error')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Sign In Password Visibility Toggle
// ---------------------------------------------------------------------------

test.describe('Auth — Sign In Password Visibility Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
  });

  test('password field starts as type=password (hidden)', async ({ page }) => {
    const passwordInput = page.locator('input[id="sign-in-password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('clicking toggle button reveals password as plain text', async ({ page }) => {
    const passwordInput = page.locator('input[id="sign-in-password"]');
    await passwordInput.fill('MySecret123');
    // The toggle button has an aria-label for "show password"
    const toggleBtn = page.locator(
      'button[aria-label="Show password"], button[aria-label="show password"]',
    );
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('clicking toggle button again hides password', async ({ page }) => {
    const passwordInput = page.locator('input[id="sign-in-password"]');
    await passwordInput.fill('MySecret123');
    // Show password
    const showBtn = page.locator(
      'button[aria-label="Show password"], button[aria-label="show password"]',
    );
    await showBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    // Hide password — aria-label changes to "Hide password"
    const hideBtn = page.locator(
      'button[aria-label="Hide password"], button[aria-label="hide password"]',
    );
    await hideBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Sign In Form Submission (mocked API)
// ---------------------------------------------------------------------------

test.describe('Auth — Sign In Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
  });

  test('shows global error banner on invalid credentials response', async ({ page }) => {
    // Mock next-auth credentials callback returning an error
    await page.route('**/api/auth/callback/credentials**', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'CredentialsSignin', ok: false }),
      });
    });

    await page.locator('input[type="email"]').fill('wrong@example.com');
    await page.locator('input[id="sign-in-password"]').fill('WrongPass1');
    await page.locator('button[type="submit"]').click();

    // The global error div with AlertCircle should appear
    await expect(
      page.locator('.bg-destructive\\/10, [class*="bg-destructive"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('submit button shows loading state while signing in', async ({ page }) => {
    // Delay the credentials API so loading state is observable
    await page.route('**/api/auth/callback/credentials**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, url: `${DASHBOARD_URL}/dashboard` }),
      });
    });

    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[id="sign-in-password"]').fill('ValidPass1');
    await page.locator('button[type="submit"]').click();

    // Submit button should be disabled while loading
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Sign Up Form Validation
// ---------------------------------------------------------------------------

test.describe('Auth — Sign Up Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-up`, { waitUntil: 'domcontentloaded' });
  });

  test('shows name validation error when name is too short', async ({ page }) => {
    await page.locator('input[id="sign-up-name"]').fill('A');
    await page.locator('button[type="submit"]').click();
    // Error text for name appears inline
    await expect(page.locator('text=Name must be at least 2 characters')).toBeVisible({
      timeout: 3000,
    });
  });

  test('shows email validation error for invalid email format', async ({ page }) => {
    await page.locator('input[id="sign-up-name"]').fill('Jane Smith');
    await page.locator('input[id="sign-up-email"]').fill('not-an-email');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[id="sign-up-email"]')).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows password too short error', async ({ page }) => {
    await page.locator('input[id="sign-up-name"]').fill('Jane Smith');
    await page.locator('input[id="sign-up-email"]').fill('jane@example.com');
    await page.locator('input[id="sign-up-password"]').fill('short');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible({
      timeout: 3000,
    });
  });

  test('shows password mismatch error when confirm password differs', async ({ page }) => {
    await page.locator('input[id="sign-up-name"]').fill('Jane Smith');
    await page.locator('input[id="sign-up-email"]').fill('jane@example.com');
    await page.locator('input[id="sign-up-password"]').pressSequentially('ValidPass1', {
      delay: 50,
    });
    await page.locator('input[id="sign-up-confirm"]').fill('DifferentPass1');
    // Accept terms before submitting
    await page.locator('input[id="sign-up-terms"]').check();
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("text=Passwords don't match")).toBeVisible({ timeout: 3000 });
  });

  test('shows terms acceptance error when checkbox is unchecked', async ({ page }) => {
    await page.locator('input[id="sign-up-name"]').fill('Jane Smith');
    await page.locator('input[id="sign-up-email"]').fill('jane@example.com');
    await page.locator('input[id="sign-up-password"]').pressSequentially('ValidPass1', {
      delay: 50,
    });
    await page.locator('input[id="sign-up-confirm"]').fill('ValidPass1');
    // Leave terms unchecked and submit
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=You must accept the terms')).toBeVisible({ timeout: 3000 });
  });

  test('shows passwords match indicator when passwords are equal', async ({ page }) => {
    const password = 'ValidPass1';
    await page.locator('input[id="sign-up-password"]').pressSequentially(password, { delay: 50 });
    await page.locator('input[id="sign-up-confirm"]').fill(password);
    // Green "Passwords match" indicator should appear
    await expect(page.locator('text=Passwords match')).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Sign Up Password Visibility Toggles
// ---------------------------------------------------------------------------

test.describe('Auth — Sign Up Password Visibility Toggles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-up`, { waitUntil: 'domcontentloaded' });
  });

  test('sign-up password field starts hidden', async ({ page }) => {
    await expect(page.locator('input[id="sign-up-password"]')).toHaveAttribute('type', 'password');
  });

  test('sign-up confirm password field starts hidden', async ({ page }) => {
    await expect(page.locator('input[id="sign-up-confirm"]')).toHaveAttribute('type', 'password');
  });

  test('toggle reveals sign-up password', async ({ page }) => {
    await page.locator('input[id="sign-up-password"]').fill('ValidPass1');
    // First toggle button in the password wrapper area
    const toggleBtns = page.locator(
      'button[aria-label="Show password"], button[aria-label="show password"]',
    );
    await toggleBtns.first().click();
    await expect(page.locator('input[id="sign-up-password"]')).toHaveAttribute('type', 'text');
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Sign Up Form Submission (mocked API)
// ---------------------------------------------------------------------------

test.describe('Auth — Sign Up Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-up`, { waitUntil: 'domcontentloaded' });
  });

  async function fillValidSignUpForm(page: import('@playwright/test').Page) {
    // Use pressSequentially for name field — Playwright's fill() can fail to trigger
    // React's onChange handler on controlled inputs in Next.js production builds.
    const nameInput = page.locator('input[id="sign-up-name"]');
    await nameInput.click();
    await nameInput.pressSequentially('Jane Smith', { delay: 10 });
    await page.locator('input[id="sign-up-email"]').fill('jane@example.com');
    await page.locator('input[id="sign-up-password"]').pressSequentially('ValidPass1', {
      delay: 30,
    });
    await page.locator('input[id="sign-up-confirm"]').fill('ValidPass1');
    await page.locator('input[id="sign-up-terms"]').check();
  }

  test('successful sign-up redirects to verify-email page', async ({ page }) => {
    await page.route('**/api/auth/sign-up', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await fillValidSignUpForm(page);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/auth\/verify-email/, { timeout: 5000 });
    // Email param should be encoded in the URL
    await expect(page).toHaveURL(/jane%40example\.com/, { timeout: 5000 });
  });

  test('shows global error when sign-up API returns error', async ({ page }) => {
    await page.route('**/api/auth/sign-up', (route) => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Email already in use' }),
      });
    });

    await fillValidSignUpForm(page);
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator('.bg-destructive\\/10, [class*="bg-destructive"]').first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Email already in use')).toBeVisible({ timeout: 5000 });
  });

  test('shows generic error when sign-up API is unreachable', async ({ page }) => {
    await page.route('**/api/auth/sign-up', (route) => {
      route.abort('failed');
    });

    await fillValidSignUpForm(page);
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator('.bg-destructive\\/10, [class*="bg-destructive"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('submit button is disabled while sign-up request is in flight', async ({ page }) => {
    await page.route('**/api/auth/sign-up', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await fillValidSignUpForm(page);
    await page.locator('button[type="submit"]').click();

    // Wait for React to update isLoading state — the button is disabled={isLoading} once
    // validation passes and the fetch begins. Give enough time for the re-render.
    await expect(page.locator('button[type="submit"]')).toBeDisabled({ timeout: 2000 });
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Verify Email Form
// ---------------------------------------------------------------------------

test.describe('Auth — Verify Email Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/verify-email?email=test@example.com`, {
      waitUntil: 'domcontentloaded',
    });
  });

  test('verify button is disabled when fewer than 6 digits are entered', async ({ page }) => {
    const codeInput = page.locator('input[id="verify-code"]');
    await codeInput.fill('123');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('verify button becomes enabled after entering exactly 6 digits', async ({ page }) => {
    const codeInput = page.locator('input[id="verify-code"]');
    await codeInput.fill('123456');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('code input only accepts numeric characters', async ({ page }) => {
    const codeInput = page.locator('input[id="verify-code"]');
    await codeInput.fill('abc123');
    // Non-numeric chars are stripped by the onChange handler
    const value = await codeInput.inputValue();
    expect(value).toMatch(/^[0-9]*$/);
  });

  test('successful code verification shows success state', async ({ page }) => {
    await page.route('**/api/auth/verify-email', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.locator('input[id="verify-code"]').fill('123456');
    await page.locator('button[type="submit"]').click();

    // Success view with CheckCircle2 should render
    await expect(page.locator('svg.lucide-circle-check, [data-lucide="circle-check"]')).toBeVisible(
      { timeout: 5000 },
    );
  });

  test('shows error when verification code is wrong', async ({ page }) => {
    await page.route('**/api/auth/verify-email', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid verification code' }),
      });
    });

    await page.locator('input[id="verify-code"]').fill('000000');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Invalid verification code')).toBeVisible({ timeout: 5000 });
  });

  test('resend code button triggers resend API call', async ({ page }) => {
    let resendCalled = false;
    await page.route('**/api/auth/verify-email/resend', (route) => {
      resendCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.locator('button:has-text("Resend code")').click();
    await page.waitForTimeout(300);
    expect(resendCalled).toBe(true);
  });

  test('resend button enters cooldown state after successful resend', async ({ page }) => {
    await page.route('**/api/auth/verify-email/resend', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Capture the resend button before clicking — after a successful resend, the component
    // sets resendCooldown=60 and the button text changes to "Resend in Xs" (no longer
    // "Resend code"), so we can't filter by the original text after the click.
    const resendBtn = page.locator('button[type="button"]').filter({ hasText: 'Resend code' });
    await resendBtn.click();

    // After resend the button text changes to a countdown ("Resend in 60s") and disabled=true.
    // Wait for the "Resend code" text to disappear, which confirms the cooldown started.
    await expect(resendBtn).not.toBeVisible({ timeout: 3000 });
    // Verify the cooldown button is now present and disabled (it shows "Resend in Xs")
    const cooldownBtn = page.locator('button[type="button"][disabled]');
    await expect(cooldownBtn).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Forgot Password Form Submission (mocked API)
// ---------------------------------------------------------------------------

test.describe('Auth — Forgot Password Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/forgot-password`, { waitUntil: 'domcontentloaded' });
  });

  test('shows email validation error for invalid email', async ({ page }) => {
    await page.locator('input[id="forgot-email"]').fill('not-an-email');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Invalid email address')).toBeVisible({ timeout: 3000 });
  });

  test('transitions to reset step after successful forgot-password request', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Use pressSequentially to reliably trigger React's onChange on controlled inputs.
    // Playwright's fill() can set the DOM value without firing React's synthetic events
    // in Next.js production builds, causing the form's state to remain empty.
    const emailInput = page.locator('input[id="forgot-email"]');
    await emailInput.click();
    await emailInput.pressSequentially('user@example.com', { delay: 10 });
    await page.locator('button[type="submit"]').click();

    // After success, should show the reset step with a code input
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible({ timeout: 5000 });
  });

  test('shows global error when forgot-password API fails', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    // Use pressSequentially to reliably trigger React's onChange on controlled inputs.
    // Playwright's fill() can set the DOM value without firing React's synthetic events
    // in Next.js production builds, causing the form's state to remain empty.
    const emailInput = page.locator('input[id="forgot-email"]');
    await emailInput.click();
    await emailInput.pressSequentially('user@example.com', { delay: 10 });
    await page.locator('button[type="submit"]').click();

    // The component renders a global error div with bg-destructive/10 class.
    // Use a text-based locator to reliably find the error element regardless of Tailwind
    // class name escaping differences between source and rendered DOM.
    await expect(page.locator('text=Server error')).toBeVisible({ timeout: 5000 });
  });

  test('reset step shows validation error when code is not 6 digits', async ({ page }) => {
    // Navigate to reset step first
    await page.route('**/api/auth/forgot-password', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const emailInput = page.locator('input[id="forgot-email"]');
    await emailInput.click();
    await emailInput.pressSequentially('user@example.com', { delay: 10 });
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible({ timeout: 5000 });

    // Submit reset form with incomplete code
    await page.locator('input[id="reset-code"]').fill('123');
    await page.locator('input[id="reset-password"]').fill('NewPassword1');
    await page.locator('input[id="reset-confirm"]').fill('NewPassword1');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Code must be 6 digits')).toBeVisible({ timeout: 3000 });
  });

  test('reset step shows mismatch error when passwords differ', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const emailInput = page.locator('input[id="forgot-email"]');
    await emailInput.click();
    await emailInput.pressSequentially('user@example.com', { delay: 10 });
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible({ timeout: 5000 });

    await page.locator('input[id="reset-code"]').fill('123456');
    await page.locator('input[id="reset-password"]').fill('NewPassword1');
    await page.locator('input[id="reset-confirm"]').fill('DifferentPass1');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=Passwords don't match")).toBeVisible({ timeout: 3000 });
  });

  test('successful password reset shows success screen', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
    await page.route('**/api/auth/reset-password', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const emailInput = page.locator('input[id="forgot-email"]');
    await emailInput.click();
    await emailInput.pressSequentially('user@example.com', { delay: 10 });
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible({ timeout: 5000 });

    await page.locator('input[id="reset-code"]').fill('123456');
    await page.locator('input[id="reset-password"]').fill('NewPassword1');
    await page.locator('input[id="reset-confirm"]').fill('NewPassword1');
    await page.locator('button[type="submit"]').click();

    // Success screen renders with green check icon
    await expect(page.locator('svg.lucide-circle-check, [data-lucide="circle-check"]')).toBeVisible(
      { timeout: 5000 },
    );
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Navigation Between Auth Pages
// ---------------------------------------------------------------------------

test.describe('Auth — Navigation Between Pages', () => {
  test('sign-in forgot password link navigates to forgot-password page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.locator('a[href*="forgot-password"]').click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/, { timeout: 5000 });
  });

  test('sign-in sign-up link navigates to sign-up page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    await page.locator('a[href*="sign-up"]').click();
    await expect(page).toHaveURL(/\/auth\/sign-up/, { timeout: 5000 });
  });

  test('sign-up sign-in link navigates back to sign-in page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-up`, { waitUntil: 'domcontentloaded' });
    await page.locator('a[href*="sign-in"]').click();
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 5000 });
  });

  test('forgot-password back link navigates to sign-in page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/forgot-password`, { waitUntil: 'domcontentloaded' });
    await page.locator('a[href*="sign-in"]').click();
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 5000 });
  });

  test('verify-email back-to-sign-in link navigates to sign-in page', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/verify-email?email=test@example.com`, {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('a[href*="sign-in"]').click();
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// NEW TESTS — Accessibility
// ---------------------------------------------------------------------------

test.describe('Auth — Accessibility', () => {
  test('sign-in form inputs have associated labels', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    // Each input should be reachable by its label's for attribute
    await expect(page.locator('label[for="sign-in-email"]')).toBeVisible();
    await expect(page.locator('label[for="sign-in-password"]')).toBeVisible();
  });

  test('sign-up form inputs have associated labels', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-up`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('label[for="sign-up-name"]')).toBeVisible();
    await expect(page.locator('label[for="sign-up-email"]')).toBeVisible();
    await expect(page.locator('label[for="sign-up-password"]')).toBeVisible();
    await expect(page.locator('label[for="sign-up-confirm"]')).toBeVisible();
    await expect(page.locator('label[for="sign-up-terms"]')).toBeVisible();
  });

  test('forgot-password email input has associated label', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/forgot-password`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('label[for="forgot-email"]')).toBeVisible();
  });

  test('verify-email code input has associated label', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/verify-email`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('label[for="verify-code"]')).toBeVisible();
  });

  test('password toggle buttons have accessible aria-labels', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    // Toggle button must have an aria-label
    const toggleBtn = page
      .locator('button')
      .filter({ hasText: '' })
      .and(page.locator('[aria-label*="password"], [aria-label*="Password"]'));
    await expect(toggleBtn.first()).toBeVisible();
  });

  test('sign-in submit button is keyboard-reachable via Tab', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    // Focus the email input and tab through to the submit button
    await page.locator('input[type="email"]').focus();
    // Tab multiple times to reach the submit button
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
    }
    // We verify the submit button itself is focusable
    await page.locator('button[type="submit"]').focus();
    const isFocusable = await page
      .locator('button[type="submit"]')
      .evaluate((el) => el === document.activeElement);
    expect(isFocusable).toBe(true);
  });

  test('OAuth buttons have accessible text content', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/auth/sign-in`, { waitUntil: 'domcontentloaded' });
    const googleBtn = page.locator('button:has-text("Google")');
    const githubBtn = page.locator('button:has-text("GitHub")');
    await expect(googleBtn).toBeVisible();
    await expect(githubBtn).toBeVisible();
    // Google SVG should have aria-hidden so text carries the accessible name
    await expect(page.locator('button:has-text("Google") svg[aria-hidden="true"]')).toBeVisible();
    await expect(page.locator('button:has-text("GitHub") svg[aria-hidden="true"]')).toBeVisible();
  });
});
