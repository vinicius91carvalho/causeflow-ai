/**
 * Source-level contract tests for CaseStudyHero.
 * Validates that the locked prop interface is present and the component
 * renders eyebrow, headline, lead, and meta-strip areas.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./case-study-hero.tsx', import.meta.url)),
  'utf-8',
);

describe('CaseStudyHero component contract', () => {
  it('exports a CaseStudyHeroProps interface with required fields', () => {
    expect(source).toMatch(/CaseStudyHeroProps/);
    expect(source).toMatch(/eyebrow/);
    expect(source).toMatch(/headline/);
    expect(source).toMatch(/lead/);
    expect(source).toMatch(/meta/);
  });

  it('accepts optional headlineEm prop', () => {
    expect(source).toMatch(/headlineEm/);
  });

  it('accepts meta.readTimeLabel, meta.severityLabel, meta.impactLabel, optional resolvedInLabel', () => {
    expect(source).toMatch(/readTimeLabel/);
    expect(source).toMatch(/severityLabel/);
    expect(source).toMatch(/impactLabel/);
    expect(source).toMatch(/resolvedInLabel\?:/);
  });

  it('renders a MetaStrip inside', () => {
    expect(source).toMatch(/MetaStrip/);
  });
});
