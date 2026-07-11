import type { Page } from '@playwright/test';

/**
 * OSS E2E helpers (AC-054).
 *
 * Analytics blockers only. Do NOT add `page.route` mocks of
 * `/api/integrations/*` or `/api/incidents*` — those are not the pass path
 * for AC-055..AC-058 (PD-OSS-DASHBOARD-E2E-CONNECTORS).
 */

/** Block analytics/tracker network requests to prevent test interference. */
export async function blockTrackers(page: Page): Promise<void> {
  await page.route('**/*.clarity.ms/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
}

/** Documented compose host ports (docker-compose.yml). */
// Use 127.0.0.1 (not localhost): Next binds to IPv4 and middleware rewrites
// must share that origin or Next treats them as external proxies.
export const OSS_DASHBOARD_URL = process.env.OSS_DASHBOARD_URL || 'http://127.0.0.1:3001';
export const OSS_CORE_API_URL = process.env.OSS_CORE_API_URL || 'http://127.0.0.1:3099';

/** Host Ornith / llama.cpp OpenAI-compatible endpoint (AC-057). */
export const OSS_ORNITH_BASE_URL = process.env.OSS_ORNITH_BASE_URL || 'http://127.0.0.1:8081/v1';
export const OSS_ORNITH_MODEL = process.env.OSS_ORNITH_MODEL || 'Ornith-1.0-9B-code';
