/**
 * Source-guard tests for cascading-500-page.tsx (Sprint 04 full implementation).
 * Validates structural contracts: all 7 sections present, no retired /get-started links,
 * i18n keys consumed, shared primitives used.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./cascading-500-page.tsx', import.meta.url)),
  'utf-8',
);

describe('Cascading500Page full implementation contract', () => {
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

  it('renders CascadeArchitectureDiagram (Section 2)', () => {
    expect(source).toMatch(/CascadeArchitectureDiagram/);
  });

  it('renders TrafficErrorChart (Section 3)', () => {
    expect(source).toMatch(/TrafficErrorChart/);
  });

  it('renders CacheRecordsVisual (Section 4)', () => {
    expect(source).toMatch(/CacheRecordsVisual/);
  });

  it('renders BeforeAfterArch (Section 5)', () => {
    expect(source).toMatch(/BeforeAfterArch/);
  });

  it('renders BusinessImpactCard (Section 6)', () => {
    expect(source).toMatch(/BusinessImpactCard/);
  });

  it('renders EvidenceCard for root cause code snippet (Section 7)', () => {
    expect(source).toMatch(/EvidenceCard/);
  });

  it('renders CtaStopHuntingSection (Section 8)', () => {
    expect(source).toMatch(/CtaStopHuntingSection/);
  });

  it('does NOT contain a link to the retired /get-started route', () => {
    // The route is retired — must not appear as an href
    expect(source).not.toMatch(/href=["']\/get-started["']/);
    expect(source).not.toMatch(/href=\{["']\/get-started["']\}/);
  });

  it('uses caseStudies.cascading500 i18n namespace', () => {
    expect(source).toMatch(/cascading500/);
  });

  it('uses OSS docs and GitHub for primary CTAs (AC-079)', () => {
    expect(source).toMatch(/ossMarketingDocsCta/);
    expect(source).toMatch(/ossMarketingGitHubCta/);
    expect(source).not.toMatch(/ROUTES\.PRICING/);
    expect(source).not.toMatch(/dashboard\.causeflow\.ai/);
  });
});
