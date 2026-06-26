import { describe, expect, it } from 'vitest';
import { CATALOG_INTEGRATIONS, lastSynced } from './integrations-catalog';

describe('integrations-catalog', () => {
  it('exports CATALOG_INTEGRATIONS with at least 28 integrations', () => {
    expect(CATALOG_INTEGRATIONS.length).toBeGreaterThanOrEqual(28);
  });

  it('every integration has id, name, category, and description', () => {
    for (const integration of CATALOG_INTEGRATIONS) {
      expect(integration.id).toBeTruthy();
      expect(integration.name).toBeTruthy();
      expect(integration.category).toBeTruthy();
      expect(integration.description).toBeTruthy();
    }
  });

  it('exports lastSynced as an ISO date string', () => {
    expect(lastSynced).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
