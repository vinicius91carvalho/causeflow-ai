/**
 * AC-057 — Investigation uses Ornith 9B via Core's local LLM connector
 * (scaffold for WI-AC-057).
 *
 * Pass path: Core OpenAI-compatible connector → Ornith on :8081.
 * Not a pass path: DeterministicLLMClient stub or Anthropic-required fallback.
 */

import { expect, test } from '@playwright/test';
import { blockTrackers } from './helpers';

test.describe('AC-057 — Ornith local LLM investigation evidence', () => {
  test.beforeEach(async ({ page }) => {
    await blockTrackers(page);
  });

  test('dashboard session is Core-local (LLM evidence owned by WI-AC-057)', async ({ page }) => {
    test.info().annotations.push({ type: 'acceptance', description: 'AC-057' });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/clerk\./);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);

    // Ornith completion evidence + fail-closed without Ornith is WI-AC-057.
    await expect(page.locator('main')).toBeVisible();
  });
});
