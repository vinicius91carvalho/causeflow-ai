import type { Page } from '@playwright/test';
import { test } from '@playwright/test';

/** Block analytics and tracker network requests to prevent test interference */
export async function blockTrackers(page: Page): Promise<void> {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

/** Skip functional tests on non-desktop viewports to reduce total test time */
export function skipOnNonDesktop(page: Page): void {
  const vp = page.viewportSize();
  test.skip(!!vp && vp.width !== 1280, 'Functional test — runs on desktop only');
}
