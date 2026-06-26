import { describe, expect, it } from 'vitest';
import { INTEGRATIONS } from './integrations';

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

  it('includes cloud category', () => {
    const categories = new Set(INTEGRATIONS.map((i) => i.category));
    expect(categories.has('cloud')).toBe(true);
  });

  it('has no mentions of composio in any field', () => {
    for (const integration of INTEGRATIONS) {
      const serialized = JSON.stringify(integration).toLowerCase();
      expect(serialized).not.toContain('composio');
    }
  });

  it('all integrations have required fields: id, name, category, description', () => {
    for (const integration of INTEGRATIONS) {
      expect(integration.id).toBeTruthy();
      expect(integration.name).toBeTruthy();
      expect(integration.category).toBeTruthy();
      expect(integration.description).toBeTruthy();
    }
  });

  it('featured integrations include key tools', () => {
    const featuredIds = INTEGRATIONS.filter((i) => i.featured).map((i) => i.id);
    expect(featuredIds).toContain('slack');
    expect(featuredIds).toContain('github');
    expect(featuredIds).toContain('datadog');
    expect(featuredIds).toContain('jira');
  });
});
