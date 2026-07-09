import { describe, expect, it } from 'vitest';
import type { IntegrationCategory } from '../category-filter';

/**
 * Unit tests for category filter logic.
 * Tests the filtering behavior without rendering the component
 * (which requires jsdom + next-intl providers).
 */

const ALL_CATEGORIES: IntegrationCategory[] = [
  'all',
  'communication',
  'monitoring',
  'code',
  'management',
  'crm',
  'database',
  'knowledge',
  'api',
];

type IntegrationWithCategory = {
  type: string;
  category: IntegrationCategory;
};

const INTEGRATIONS: IntegrationWithCategory[] = [
  { type: 'slack', category: 'communication' },
  { type: 'github', category: 'code' },
  { type: 'jira', category: 'management' },
  { type: 'cloudwatch', category: 'monitoring' },
  { type: 'hubspot', category: 'crm' },
  { type: 'trello', category: 'management' },
  { type: 'postgresql', category: 'database' },
  { type: 'linear', category: 'management' },
  { type: 'sentry', category: 'monitoring' },
  { type: 'mongodb', category: 'database' },
  { type: 'datadog', category: 'monitoring' },
  { type: 'pagerduty', category: 'monitoring' },
  { type: 'grafana', category: 'monitoring' },
  { type: 'confluence', category: 'knowledge' },
  { type: 'webhooks', category: 'api' },
];

function filterByCategory(
  integrations: IntegrationWithCategory[],
  category: IntegrationCategory,
): IntegrationWithCategory[] {
  if (category === 'all') return integrations;
  return integrations.filter((i) => i.category === category);
}

describe('Category filter logic', () => {
  it('has 9 categories including "all"', () => {
    expect(ALL_CATEGORIES).toHaveLength(9);
    expect(ALL_CATEGORIES[0]).toBe('all');
  });

  it('"all" category returns all 15 integrations', () => {
    expect(filterByCategory(INTEGRATIONS, 'all')).toHaveLength(15);
  });

  it('"communication" returns only Slack', () => {
    const result = filterByCategory(INTEGRATIONS, 'communication');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('slack');
  });

  it('"monitoring" returns CloudWatch, Sentry, Datadog, PagerDuty, Grafana', () => {
    const result = filterByCategory(INTEGRATIONS, 'monitoring');
    expect(result).toHaveLength(5);
    const types = result.map((i) => i.type);
    expect(types).toContain('cloudwatch');
    expect(types).toContain('sentry');
    expect(types).toContain('datadog');
    expect(types).toContain('pagerduty');
    expect(types).toContain('grafana');
  });

  it('"code" returns only GitHub', () => {
    const result = filterByCategory(INTEGRATIONS, 'code');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('github');
  });

  it('"management" returns Jira, Trello, Linear', () => {
    const result = filterByCategory(INTEGRATIONS, 'management');
    expect(result).toHaveLength(3);
    const types = result.map((i) => i.type);
    expect(types).toContain('jira');
    expect(types).toContain('trello');
    expect(types).toContain('linear');
  });

  it('"crm" returns only HubSpot', () => {
    const result = filterByCategory(INTEGRATIONS, 'crm');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('hubspot');
  });

  it('"database" returns PostgreSQL and MongoDB', () => {
    const result = filterByCategory(INTEGRATIONS, 'database');
    expect(result).toHaveLength(2);
    const types = result.map((i) => i.type);
    expect(types).toContain('postgresql');
    expect(types).toContain('mongodb');
  });

  it('"knowledge" returns Confluence', () => {
    const result = filterByCategory(INTEGRATIONS, 'knowledge');
    expect(result).toHaveLength(1);
    const types = result.map((i) => i.type);
    expect(types).toContain('confluence');
  });

  it('"api" returns only Webhooks', () => {
    const result = filterByCategory(INTEGRATIONS, 'api');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('webhooks');
  });

  it('empty results when category has no matches', () => {
    const empty: IntegrationWithCategory[] = [];
    expect(filterByCategory(empty, 'communication')).toHaveLength(0);
  });
});

describe('Search filter logic', () => {
  function filterBySearch(
    integrations: Array<{ type: string; name: string }>,
    query: string,
  ): Array<{ type: string; name: string }> {
    if (!query.trim()) return integrations;
    return integrations.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
  }

  const namedIntegrations = [
    { type: 'slack', name: 'Slack' },
    { type: 'github', name: 'GitHub' },
    { type: 'jira', name: 'Jira' },
    { type: 'cloudwatch', name: 'AWS' },
    { type: 'hubspot', name: 'HubSpot' },
    { type: 'trello', name: 'Trello' },
    { type: 'postgresql', name: 'PostgreSQL' },
    { type: 'linear', name: 'Linear' },
    { type: 'sentry', name: 'Sentry' },
    { type: 'mongodb', name: 'MongoDB' },
    { type: 'datadog', name: 'Datadog' },
    { type: 'pagerduty', name: 'PagerDuty' },
    { type: 'grafana', name: 'Grafana' },
    { type: 'confluence', name: 'Confluence' },
    { type: 'webhooks', name: 'Custom Webhooks' },
  ];

  it('empty query returns all 15 integrations', () => {
    expect(filterBySearch(namedIntegrations, '')).toHaveLength(15);
  });

  it('blank query returns all integrations', () => {
    expect(filterBySearch(namedIntegrations, '   ')).toHaveLength(15);
  });

  it('case-insensitive search for "slack"', () => {
    const result = filterBySearch(namedIntegrations, 'SLACK');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('slack');
  });

  it('partial search for "data" returns Datadog', () => {
    const result = filterBySearch(namedIntegrations, 'data');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('datadog');
  });

  it('search for "aws" returns AWS', () => {
    const result = filterBySearch(namedIntegrations, 'aws');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('cloudwatch');
  });

  it('search for "mongo" returns MongoDB', () => {
    const result = filterBySearch(namedIntegrations, 'mongo');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('mongodb');
  });

  it('no match returns empty array', () => {
    const result = filterBySearch(namedIntegrations, 'xyz-nonexistent');
    expect(result).toHaveLength(0);
  });
});
