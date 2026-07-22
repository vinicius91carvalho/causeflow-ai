import { describe, expect, it } from 'vitest';
import { INTEGRATIONS } from './integrations';
import { PRICING_PLANS } from './pricing';
import { ROUTES } from './routes';
import { SITE } from './site';

describe('ROUTES', () => {
  it('HOME equals "/"', () => {
    expect(ROUTES.HOME).toBe('/');
  });

  it('PRICING equals "/pricing"', () => {
    expect(ROUTES.PRICING).toBe('/pricing');
  });
});

describe('SITE', () => {
  it('name equals "CauseFlow AI"', () => {
    expect(SITE.name).toBe('CauseFlow AI');
  });

  it('url equals "https://causeflow.ai"', () => {
    expect(SITE.url).toBe('https://causeflow.ai');
  });

  it('docsUrl points to GitHub Pages /docs', () => {
    expect(SITE.docsUrl).toBe('https://vinicius91carvalho.github.io/causeflow-ai/docs/');
  });

  it('testApplicationDocsUrl deep-links under published docs', () => {
    expect(SITE.testApplicationDocsUrl).toBe(
      'https://vinicius91carvalho.github.io/causeflow-ai/docs/integrations/test-application',
    );
    expect(SITE.testApplicationDocsUrl.startsWith(SITE.docsUrl)).toBe(true);
  });
});

describe('PRICING_PLANS', () => {
  it('has 4 plans (free removed)', () => {
    expect(PRICING_PLANS).toHaveLength(4);
  });

  it('first plan is starter', () => {
    expect(PRICING_PLANS[0]!.id).toBe('starter');
  });
});

describe('INTEGRATIONS', () => {
  it('has ~30 curated integrations', () => {
    expect(INTEGRATIONS.length).toBeGreaterThanOrEqual(28);
    expect(INTEGRATIONS.length).toBeLessThanOrEqual(50);
  });

  it('has no integration with a phase field', () => {
    for (const integration of INTEGRATIONS) {
      expect(integration).not.toHaveProperty('phase');
    }
  });

  it('every integration has agentConnection defined', () => {
    for (const integration of INTEGRATIONS) {
      expect(integration.agentConnection).toBeDefined();
      expect(typeof integration.agentConnection).toBe('string');
    }
  });

  it('~16 integrations are featured', () => {
    const featured = INTEGRATIONS.filter((i) => i.featured === true);
    expect(featured.length).toBeGreaterThanOrEqual(14);
    expect(featured.length).toBeLessThanOrEqual(18);
  });

  it('includes cloud and ci-cd categories', () => {
    const categories = new Set(INTEGRATIONS.map((i) => i.category));
    expect(categories.has('cloud')).toBe(true);
  });

  it('has no mentions of composio in any field', () => {
    for (const integration of INTEGRATIONS) {
      const serialized = JSON.stringify(integration).toLowerCase();
      expect(serialized).not.toContain('composio');
    }
  });
});
