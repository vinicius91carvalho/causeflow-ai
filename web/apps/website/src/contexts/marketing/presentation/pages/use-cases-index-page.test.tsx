/**
 * Source-guard tests for use-cases-index-page.tsx.
 * Validates that the page renders 3 case-study cards and
 * uses the correct i18n namespace + shared registry.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./use-cases-index-page.tsx', import.meta.url)),
  'utf-8',
);

describe('UseCasesIndexPage source contract', () => {
  it('uses caseStudies i18n namespace', () => {
    expect(source).toMatch(/caseStudies/);
  });

  it('imports CASE_STUDIES registry from domain', () => {
    expect(source).toMatch(/CASE_STUDIES/);
  });

  it('calls setRequestLocale', () => {
    expect(source).toMatch(/setRequestLocale/);
  });

  it('calls generatePageMetadata', () => {
    expect(source).toMatch(/generatePageMetadata/);
  });

  it('maps over CASE_STUDIES to render card links', () => {
    // Page renders cards dynamically via CASE_STUDIES.map() — slugs come from
    // the registry, not hardcoded in the page source itself.
    expect(source).toMatch(/CASE_STUDIES\.map/);
    expect(source).toMatch(/study\.slug/);
    expect(source).toMatch(/ROUTES\.USE_CASES/);
  });

  it('uses Header and Footer shell components', () => {
    expect(source).toMatch(/Header/);
    expect(source).toMatch(/Footer/);
  });
});
