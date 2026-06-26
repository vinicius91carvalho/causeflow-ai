/**
 * CaseStudy domain types and registry.
 *
 * Shared contract consumed by:
 *   - use-cases-index-page.tsx  (index hub)
 *   - Sprints 02/03/04          (bespoke scenario pages)
 *
 * Do NOT rename exported identifiers without updating those consumers.
 */

export type CaseStudyTemplate = 'forensic-dossier' | 'budget-clock' | 'cascade';

export type CaseStudySeverity = 'high' | 'medium' | 'low';

export interface CaseStudy {
  slug: 'stale-pricing' | 'broken-images' | 'cascading-500';
  i18nKey: 'stalePricing' | 'brokenImages' | 'cascading500';
  template: CaseStudyTemplate;
  severity: CaseStudySeverity;
  /** Static label rendered in cards, e.g. "25 min". Final copy lives in i18n. */
  durationLabel: string;
  /** ISO 8601 date string, e.g. "2026-04-01". */
  publishedAt: string;
}

export const CASE_STUDIES: readonly CaseStudy[] = [
  {
    slug: 'stale-pricing',
    i18nKey: 'stalePricing',
    template: 'forensic-dossier',
    severity: 'high',
    durationLabel: '25 min',
    publishedAt: '2026-04-16',
  },
  {
    slug: 'broken-images',
    i18nKey: 'brokenImages',
    template: 'budget-clock',
    severity: 'high',
    durationLabel: '8 min',
    publishedAt: '2026-04-16',
  },
  {
    slug: 'cascading-500',
    i18nKey: 'cascading500',
    template: 'cascade',
    severity: 'high',
    durationLabel: '10 min',
    publishedAt: '2026-04-16',
  },
] as const;
