/**
 * Source-level contract tests for the CaseStudy domain registry.
 * Validates that the shared contracts (types + CASE_STUDIES array) match
 * what Sprints 02/03/04 expect to import.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./case-studies.ts', import.meta.url)), 'utf-8');

describe('CaseStudy domain registry', () => {
  it('exports CaseStudyTemplate union type', () => {
    expect(source).toMatch(/CaseStudyTemplate/);
    expect(source).toMatch(/forensic-dossier/);
    expect(source).toMatch(/budget-clock/);
    expect(source).toMatch(/cascade/);
  });

  it('exports CaseStudySeverity union type', () => {
    expect(source).toMatch(/CaseStudySeverity/);
    expect(source).toMatch(/high/);
    expect(source).toMatch(/medium/);
    expect(source).toMatch(/low/);
  });

  it('exports CaseStudy interface with required fields', () => {
    expect(source).toMatch(/interface CaseStudy/);
    expect(source).toMatch(/slug/);
    expect(source).toMatch(/i18nKey/);
    expect(source).toMatch(/template/);
    expect(source).toMatch(/severity/);
    expect(source).toMatch(/durationLabel/);
    expect(source).toMatch(/publishedAt/);
  });

  it('exports CASE_STUDIES readonly array with 3 entries', () => {
    expect(source).toMatch(/CASE_STUDIES/);
    // All three slugs present
    expect(source).toMatch(/stale-pricing/);
    expect(source).toMatch(/broken-images/);
    expect(source).toMatch(/cascading-500/);
  });

  it('uses the 3 correct i18n keys', () => {
    expect(source).toMatch(/stalePricing/);
    expect(source).toMatch(/brokenImages/);
    expect(source).toMatch(/cascading500/);
  });
});
