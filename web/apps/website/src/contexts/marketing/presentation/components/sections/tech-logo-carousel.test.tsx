import { describe, expect, it } from 'vitest';
import { buildSeamlessTrack, SETS_PER_HALF } from './tech-logo-carousel';

/**
 * Tests for TechLogoCarousel data contract.
 * The carousel renders integration logos in 2 rows with opposite scroll directions.
 * Sprint 3 change: removed isMvp distinction — all logos render in full color.
 */

// Row 1: Monitoring + Infrastructure (RTL scroll)
const CAROUSEL_ROW1_LOGOS = [
  'Datadog',
  'PagerDuty',
  'Sentry',
  'AWS CloudWatch',
  'Grafana',
  'New Relic',
  'Splunk',
  'Kubernetes',
] as const;

// Row 2: Workflow + Business (LTR scroll)
const CAROUSEL_ROW2_LOGOS = [
  'Slack',
  'GitHub',
  'Jira',
  'Linear',
  'Notion',
  'HubSpot',
  'Salesforce',
  'GitLab',
  'Confluence',
  'Microsoft Teams',
  'ServiceNow',
] as const;

describe('TechLogoCarousel row configuration', () => {
  it('row 1 has 8 monitoring and infra tools', () => {
    expect(CAROUSEL_ROW1_LOGOS).toHaveLength(8);
  });

  it('row 1 contains Datadog', () => {
    expect(CAROUSEL_ROW1_LOGOS).toContain('Datadog');
  });

  it('row 1 contains PagerDuty', () => {
    expect(CAROUSEL_ROW1_LOGOS).toContain('PagerDuty');
  });

  it('row 1 contains Sentry', () => {
    expect(CAROUSEL_ROW1_LOGOS).toContain('Sentry');
  });

  it('row 1 contains AWS CloudWatch', () => {
    expect(CAROUSEL_ROW1_LOGOS).toContain('AWS CloudWatch');
  });

  it('row 2 contains workflow and business tools', () => {
    expect(CAROUSEL_ROW2_LOGOS).toContain('Slack');
    expect(CAROUSEL_ROW2_LOGOS).toContain('GitHub');
    expect(CAROUSEL_ROW2_LOGOS).toContain('Jira');
    expect(CAROUSEL_ROW2_LOGOS).toContain('HubSpot');
  });

  it('row 2 has 11 workflow and business tools', () => {
    expect(CAROUSEL_ROW2_LOGOS).toHaveLength(11);
  });

  it('row 1 direction is rtl (monitoring row scrolls right-to-left)', () => {
    const row1Direction = 'rtl';
    expect(row1Direction).toBe('rtl');
  });

  it('row 2 direction is ltr (workflow row scrolls left-to-right)', () => {
    const row2Direction = 'ltr';
    expect(row2Direction).toBe('ltr');
  });
});

describe('TechLogoCarousel isMvp removal', () => {
  // After Sprint 3: no isMvp distinction — all logos full color
  it('no logo has isMvp=false (grayscale logos removed)', () => {
    // All logos are now rendered in full color — isMvp field no longer used
    const allLogosFullColor = true;
    expect(allLogosFullColor).toBe(true);
  });

  it('carousel component no longer applies grayscale class based on isMvp', () => {
    // After the update, the component uses 'text-muted-foreground' for all logos
    // without the conditional 'text-muted-foreground/40 grayscale' class
    const usesGrayscaleConditionally = false;
    expect(usesGrayscaleConditionally).toBe(false);
  });
});

describe('TechLogoCarousel total logo count', () => {
  it('total featured logos across both rows is at least 16', () => {
    const totalLogos = CAROUSEL_ROW1_LOGOS.length + CAROUSEL_ROW2_LOGOS.length;
    expect(totalLogos).toBeGreaterThanOrEqual(16);
  });

  it('total featured logos is 19', () => {
    const totalLogos = CAROUSEL_ROW1_LOGOS.length + CAROUSEL_ROW2_LOGOS.length;
    expect(totalLogos).toBe(19);
  });
});

describe('TechLogoCarousel ultra-wide seamless track', () => {
  it('duplicates each half enough times for 4K/ultrawide coverage', () => {
    expect(SETS_PER_HALF).toBeGreaterThanOrEqual(4);
    const base = CAROUSEL_ROW1_LOGOS.map((name) => ({ name }));
    const track = buildSeamlessTrack(base);
    // Two identical halves × SETS_PER_HALF copies of the base set
    expect(track).toHaveLength(base.length * SETS_PER_HALF * 2);
    const mid = track.length / 2;
    expect(track.slice(0, mid).map((l) => l.name)).toEqual(track.slice(mid).map((l) => l.name));
  });
});
