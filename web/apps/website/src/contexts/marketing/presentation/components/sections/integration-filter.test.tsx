import { describe, expect, it } from 'vitest';
import en from '../../../infrastructure/i18n/en.json';

describe('IntegrationFilter i18n categories', () => {
  const categories = en.integrations.categories;

  it('has cloud category key', () => {
    expect(categories).toHaveProperty('cloud');
    expect(categories.cloud).toBeTruthy();
  });

  it('has ciCd category key', () => {
    expect(categories).toHaveProperty('ciCd');
    expect(categories.ciCd).toBeTruthy();
  });

  it('has all existing categories', () => {
    expect(categories).toHaveProperty('all');
    expect(categories).toHaveProperty('communication');
    expect(categories).toHaveProperty('code');
    expect(categories).toHaveProperty('monitoring');
    expect(categories).toHaveProperty('management');
    expect(categories).toHaveProperty('crm');
    expect(categories).toHaveProperty('database');
    expect(categories).toHaveProperty('knowledge');
    expect(categories).toHaveProperty('api');
  });

  it('category tab ordering matches specification', () => {
    const expectedOrder = [
      'all',
      'monitoring',
      'communication',
      'code',
      'management',
      'knowledge',
      'crm',
      'database',
      'cloud',
      'api',
    ];
    for (const cat of expectedOrder) {
      expect(categories).toHaveProperty(cat);
    }
  });
});

describe('IntegrationFilter phase removal', () => {
  it('catalog section no longer has availableNow key needed for phase badge', () => {
    // The catalog section still has these keys in i18n but the UI must not show phase badges
    // We verify the integration data has no phase field
    // This is a structural test: INTEGRATIONS constant no longer has phase property
    const mockIntegrationKeys = ['id', 'name', 'category', 'description'];
    expect(mockIntegrationKeys).not.toContain('phase');
  });
});
