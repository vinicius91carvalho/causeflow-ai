/**
 * Source-guard tests for stale-pricing-page.tsx (placeholder).
 * Sprint 02 will replace the body; this guard ensures the scaffold is wired correctly.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./stale-pricing-page.tsx', import.meta.url)),
  'utf-8',
);

describe('StalePricingPage placeholder contract', () => {
  it('calls setRequestLocale', () => {
    expect(source).toMatch(/setRequestLocale/);
  });

  it('calls generatePageMetadata', () => {
    expect(source).toMatch(/generatePageMetadata/);
  });

  it('renders CaseStudyHero', () => {
    expect(source).toMatch(/CaseStudyHero/);
  });

  it('renders CaseStudyBreadcrumb', () => {
    expect(source).toMatch(/CaseStudyBreadcrumb/);
  });
});
