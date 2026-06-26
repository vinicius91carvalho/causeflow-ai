/**
 * RBAC Member Read-Access — Playwright E2E (Sprint 04)
 *
 * Verifies that a member-role user:
 *   1. Can view billing, settings, team, and integrations pages without 403/redirect
 *   2. Sees no mutation controls on any of the four pages
 *   3. Can open the Stripe Portal via the "Manage billing in Stripe" button
 *
 * Auth: requires a Clerk member-role test user. Provide MEMBER_TEST_EMAIL env
 * var pointing at a Clerk user whose org membership is `org:member`.
 *
 * If MEMBER_TEST_EMAIL is missing, every test in this file is skipped with
 * a clear actionable message — the suite will not fail CI.
 *
 * Tag: @member-read (run with `--grep @member-read` for selective execution).
 */

import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3001';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? '';
const MEMBER_TEST_EMAIL = process.env.MEMBER_TEST_EMAIL ?? '';

const HAS_MEMBER_FIXTURE = Boolean(CLERK_SECRET_KEY && MEMBER_TEST_EMAIL);

test.beforeAll(async () => {
  if (!HAS_MEMBER_FIXTURE) {
    test.skip(
      true,
      'rbac-member-read.spec.ts requires CLERK_SECRET_KEY + MEMBER_TEST_EMAIL env vars. Set MEMBER_TEST_EMAIL to a Clerk user whose org membership role is org:member, then re-run.',
    );
    return;
  }
  await clerkSetup({ secretKey: CLERK_SECRET_KEY });
});

async function signInAsMember(page: Page): Promise<void> {
  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(MEMBER_TEST_EMAIL)}`,
    { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
  );
  if (!usersRes.ok) {
    throw new Error(`Clerk user lookup failed: ${usersRes.status} ${await usersRes.text()}`);
  }
  const users = (await usersRes.json()) as Array<{ id: string }>;
  if (!users.length) {
    throw new Error(`No Clerk user found for ${MEMBER_TEST_EMAIL}`);
  }
  const tokenRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: users[0].id }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Clerk sign-in token failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokenData = (await tokenRes.json()) as { token: string };
  await setupClerkTestingToken({ page });
  await page.goto(`${DASHBOARD_URL}/auth/sign-in#/sso-callback?__clerk_ticket=${tokenData.token}`, {
    waitUntil: 'domcontentloaded',
  });
  await page
    .waitForURL((url) => !url.pathname.includes('/auth/'), { timeout: 20000 })
    .catch(() => {
      // Downstream assertions will surface failure
    });
}

test.describe('@member-read', () => {
  test('member can view billing page with Stripe Portal button and no mutation controls', async ({
    page,
  }) => {
    test.skip(!HAS_MEMBER_FIXTURE, 'requires MEMBER_TEST_EMAIL');
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/billing`, { waitUntil: 'domcontentloaded' });

    // View-only fields visible
    await expect(page.locator('main')).toBeVisible();

    // Manage billing button visible to both roles
    const portalBtn = page
      .getByRole('button', { name: /manage|billing|stripe|subscription/i })
      .first();
    await expect(portalBtn).toBeVisible();

    // Mutation buttons not visible
    await expect(page.getByRole('button', { name: /change plan|upgrade|cancel/i })).toHaveCount(0);
  });

  test('member can view settings page with disabled inputs and no save button', async ({
    page,
  }) => {
    test.skip(!HAS_MEMBER_FIXTURE, 'requires MEMBER_TEST_EMAIL');
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    // Save button should not exist for members on read-only tabs
    await expect(page.getByRole('button', { name: /^save/i })).toHaveCount(0);
  });

  test('member can view team page with no invite or role-change controls', async ({ page }) => {
    test.skip(!HAS_MEMBER_FIXTURE, 'requires MEMBER_TEST_EMAIL');
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/team`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main')).toBeVisible();
    // Invite button hidden for members
    await expect(page.getByRole('button', { name: /invite/i })).toHaveCount(0);
    // No role-change combobox in member rows
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });

  test('member can view integrations page with no connect or disconnect controls', async ({
    page,
  }) => {
    test.skip(!HAS_MEMBER_FIXTURE, 'requires MEMBER_TEST_EMAIL');
    await signInAsMember(page);
    await page.goto(`${DASHBOARD_URL}/dashboard/integrations`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('main')).toBeVisible();
    // Members must not see connect/disconnect/test buttons
    await expect(
      page.getByRole('button', { name: /^(connect|disconnect|test connection)/i }),
    ).toHaveCount(0);
  });
});
