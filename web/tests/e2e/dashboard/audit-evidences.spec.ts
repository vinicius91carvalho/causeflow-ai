/**
 * Sprint 04 — Audit timeline: evidences rendering (AC-3)
 *
 * Verifies:
 *  - Entry with evidences: the EvidencesList toggle button is visible, and after
 *    clicking it the evidence content strings appear in the DOM.
 *  - Entry with evidences=undefined: no evidence toggle rendered for that row.
 *  - Entry with evidences=[]: no evidence toggle rendered for that row.
 *
 * EvidencesList in audit-list.tsx:
 *  - Renders a <div className="mt-2"> containing a <button> (aria-expanded) and
 *    (when open) a <ul> with each evidence as a <li>.
 *  - Returns null when evidences.length === 0.
 *  - The parent only renders EvidencesList if entry.evidences && entry.evidences.length > 0.
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

function baseEntry(id: string, offset: number) {
  return {
    tenantId: 'tenant-test',
    entryId: id,
    action: 'incident.created',
    actorType: 'user',
    actorEmail: `actor-${id}@test.example`,
    resourceType: 'incident',
    resourceId: `inc-${id}`,
    entryHash: `hash${id}hash${id}hash${id}`,
    createdAt: new Date(Date.now() - offset * 60_000).toISOString(),
  };
}

const FIXTURE_ENTRIES = [
  // Entry A: two evidences
  {
    ...baseEntry('ev-a', 0),
    evidences: [
      { type: 'log', content: 'CRITICAL: db connection refused', source: 'cloudwatch' },
      { type: 'metric', content: 'cpu 99%' },
    ],
  },
  // Entry B: evidences=undefined (field absent)
  {
    ...baseEntry('ev-b', 1),
  },
  // Entry C: evidences=[] (empty array)
  {
    ...baseEntry('ev-c', 2),
    evidences: [],
  },
];

test.describe('Audit — evidences rendering (AC-3)', () => {
  test.use({ baseURL: DASHBOARD_URL });

  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);

    await page.route('**/api/audit**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: FIXTURE_ENTRIES }),
      });
    });
  });

  test('entry with evidences: toggle button visible and content revealed on click', async ({
    page,
  }) => {
    await page.goto('/dashboard/audit', { waitUntil: 'domcontentloaded' });

    // Wait for entries to appear
    await expect(page.locator('text=actor-ev-a@test.example').first()).toBeVisible();

    // Locate the card for entry A
    const cardA = page.locator('.rounded-lg.border.border-border.bg-card', {
      hasText: 'inc-ev-a',
    });
    await expect(cardA).toBeVisible();

    // The EvidencesList renders a <button> with aria-expanded attribute
    const toggleBtn = cardA.locator('button[aria-expanded]');
    await expect(toggleBtn).toBeVisible();

    // Before clicking: evidence content should NOT be in the DOM (collapsed)
    await expect(page.locator('text=CRITICAL: db connection refused')).not.toBeVisible();
    await expect(page.locator('text=cpu 99%')).not.toBeVisible();

    // Click to expand
    await toggleBtn.click();

    // After expanding: both evidence content strings must appear
    await expect(cardA.locator('text=CRITICAL: db connection refused')).toBeVisible();
    await expect(cardA.locator('text=cpu 99%')).toBeVisible();
  });

  test('entry with evidences=undefined: no evidence toggle rendered', async ({ page }) => {
    await page.goto('/dashboard/audit', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=actor-ev-a@test.example').first()).toBeVisible();

    // Card B — no evidences field
    const cardB = page.locator('.rounded-lg.border.border-border.bg-card', {
      hasText: 'inc-ev-b',
    });
    await expect(cardB).toBeVisible();

    // No evidence toggle button inside card B
    const toggleBtn = cardB.locator('button[aria-expanded]');
    await expect(toggleBtn).toHaveCount(0);
  });

  test('entry with evidences=[]: no evidence toggle rendered', async ({ page }) => {
    await page.goto('/dashboard/audit', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=actor-ev-a@test.example').first()).toBeVisible();

    // Card C — empty evidences array
    const cardC = page.locator('.rounded-lg.border.border-border.bg-card', {
      hasText: 'inc-ev-c',
    });
    await expect(cardC).toBeVisible();

    // No evidence toggle button inside card C
    const toggleBtn = cardC.locator('button[aria-expanded]');
    await expect(toggleBtn).toHaveCount(0);
  });
});
