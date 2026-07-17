/**
 * Root AC-003 (supersedes web AC-078 redirect): /pricing hard-removed → 404.
 */
import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

const OSS_WEBSITE_URL = process.env.OSS_WEBSITE_URL || 'http://127.0.0.1:3000';

test.describe('AC-003 — pricing routes hard-removed (404)', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('GET /pricing and /pt-br/pricing return 404 without plan cards or sales redirect', async ({
    page,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-003' });

    for (const path of ['/pricing', '/pt-br/pricing'] as const) {
      const res = await fetch(`${OSS_WEBSITE_URL}${path}`, { redirect: 'manual' });
      expect(res.status, `${path} HTTP status`).toBe(404);
      expect(res.headers.get('location')).toBeNull();
      const body = await res.text();
      expect(body).not.toMatch(/\$99|\$349|\$899/);
    }

    await page.goto(`${OSS_WEBSITE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/vinicius91carvalho\.github\.io|\/pricing\/?$/);
    await expect(
      page.getByText(/\$99|\$349|\$899|Starter plan|Pro plan|Business plan/i),
    ).toHaveCount(0);

    await page.goto(`${OSS_WEBSITE_URL}/pt-br/pricing`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(/\$99|\$349|\$899|Starter plan|Pro plan|Business plan/i),
    ).toHaveCount(0);
  });
});
