/**
 * Sprint 04 — Audit timeline: Load More pagination (AC-1)
 *
 * Verifies:
 *  - Load More appends a second page of distinct entries
 *  - Entries render in the order returned (createdAt desc)
 *  - Load More button disappears when the API returns no cursor
 *
 * Uses page.route to mock /api/audit deterministically — no dependency on
 * the mock Core API client or on a real DynamoDB table.
 *
 * Runs under the e2e-dashboard-authed Playwright project at viewport 1280x800.
 */

import { expect, test } from '@playwright/test';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

async function blockTrackers(page: import('@playwright/test').Page) {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

/** Build a minimal AuditEntry fixture. */
function makeEntry(id: string, createdAt: string) {
  return {
    tenantId: 'tenant-test',
    entryId: id,
    action: 'incident.created',
    actorType: 'user',
    actorEmail: `actor-${id}@test.example`,
    resourceType: 'incident',
    resourceId: `inc-${id}`,
    entryHash: `hash${id}hash${id}hash${id}`,
    createdAt,
  };
}

/** Generate N entries with descending timestamps starting from baseMs. */
function makeEntries(count: number, baseMs: number, prefix: string) {
  return Array.from({ length: count }, (_, i) =>
    makeEntry(`${prefix}-${i}`, new Date(baseMs - i * 60_000).toISOString()),
  );
}

test.describe('Audit — Load More pagination (AC-1)', () => {
  test.use({ baseURL: DASHBOARD_URL });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('Load More appends a second page distinct from the first', async ({ page }) => {
    const page1Entries = makeEntries(20, Date.now(), 'pg1');
    const page2Entries = makeEntries(5, Date.now() - 21 * 60_000, 'pg2');

    let callCount = 0;
    await page.route('**/api/audit**', (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: page1Entries, cursor: 'page-2' }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: page2Entries }),
        });
      }
    });

    await page.goto('/dashboard/audit', { waitUntil: 'domcontentloaded' });

    // Wait for initial entries to render
    // The component renders entries inside div.space-y-2 — each entry is a rounded-lg border card
    await expect(page.locator('text=actor-pg1-0@test.example').first()).toBeVisible();

    // Count rendered entry cards (all 20 page-1 entries should be visible)
    const entryCards = page.locator('.rounded-lg.border.border-border.bg-card');
    await expect(entryCards).toHaveCount(20);

    // Load More button should be visible
    const loadMoreBtn = page.getByRole('button', { name: /load more/i });
    await expect(loadMoreBtn).toBeVisible();

    // Click Load More
    await loadMoreBtn.click();

    // Now 25 entries should be visible (20 + 5)
    await expect(entryCards).toHaveCount(25);

    // Verify page-2 entries are present (no duplicates — different ids)
    await expect(page.locator('text=actor-pg2-0@test.example').first()).toBeVisible();

    // Load More button should be gone (no cursor returned from page 2)
    await expect(loadMoreBtn).not.toBeVisible();
  });

  test('Entries render in createdAt desc order (input order preserved)', async ({ page }) => {
    const baseMs = new Date('2026-04-30T12:00:00Z').getTime();
    const entries = makeEntries(5, baseMs, 'ord');

    await page.route('**/api/audit**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: entries }),
      });
    });

    await page.goto('/dashboard/audit', { waitUntil: 'domcontentloaded' });

    // Wait for entries to appear
    await expect(page.locator('text=actor-ord-0@test.example').first()).toBeVisible();

    // Collect the rendered email texts in DOM order
    const emailTexts = await page
      .locator('p.text-xs.font-medium.text-foreground.truncate')
      .allTextContents();

    // The component renders entries in the order returned by the API (desc by createdAt).
    // Verify the first 5 match the input order: ord-0, ord-1, ord-2, ord-3, ord-4
    expect(emailTexts[0]).toContain('actor-ord-0@test.example');
    expect(emailTexts[1]).toContain('actor-ord-1@test.example');
    expect(emailTexts[2]).toContain('actor-ord-2@test.example');
    expect(emailTexts[3]).toContain('actor-ord-3@test.example');
    expect(emailTexts[4]).toContain('actor-ord-4@test.example');
  });

  test('No Load More when first page has no cursor', async ({ page }) => {
    const entries = makeEntries(3, Date.now(), 'single');

    await page.route('**/api/audit**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // No cursor field — hasMore should stay false
        body: JSON.stringify({ items: entries }),
      });
    });

    await page.goto('/dashboard/audit', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=actor-single-0@test.example').first()).toBeVisible();

    // Load More must never appear
    const loadMoreBtn = page.getByRole('button', { name: /load more/i });
    await expect(loadMoreBtn).not.toBeVisible();
  });
});
