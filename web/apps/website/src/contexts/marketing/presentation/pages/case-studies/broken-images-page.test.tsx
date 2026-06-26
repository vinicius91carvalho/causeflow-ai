/**
 * Source-guard tests for broken-images-page.tsx (placeholder).
 * Sprint 03 will replace the body.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./broken-images-page.tsx', import.meta.url)),
  'utf-8',
);

describe('BrokenImagesPage placeholder contract', () => {
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
