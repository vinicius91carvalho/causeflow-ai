/**
 * AC-078 — Legacy /pricing routes redirect to published OSS docs.
 */
import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

const OSS_WEBSITE_URL = process.env.OSS_WEBSITE_URL || 'http://127.0.0.1:3000';
const DOCS_URL = 'https://vinicius91carvalho.github.io/causeflow-ai/';

test.describe('AC-078 — pricing routes redirect to docs', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('GET /pricing and /pt-br/pricing redirect to SITE.docsUrl without plan cards', async ({
    page,
  }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-078' });

    for (const path of ['/pricing', '/pt-br/pricing'] as const) {
      const res = await fetch(`${OSS_WEBSITE_URL}${path}`, { redirect: 'manual' });
      expect(res.status, `${path} HTTP redirect`).toBeGreaterThanOrEqual(300);
      expect(res.status, `${path} HTTP redirect`).toBeLessThan(400);
      expect(res.headers.get('location')).toBe(DOCS_URL);
    }

    await page.goto(`${OSS_WEBSITE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/vinicius91carvalho\.github\.io\/causeflow-ai/);
    await expect(
      page.getByText(/\$99|\$349|\$899|Starter plan|Pro plan|Business plan/i),
    ).toHaveCount(0);

    await page.goto(`${OSS_WEBSITE_URL}/pt-br/pricing`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/vinicius91carvalho\.github\.io\/causeflow-ai/);
  });
});
