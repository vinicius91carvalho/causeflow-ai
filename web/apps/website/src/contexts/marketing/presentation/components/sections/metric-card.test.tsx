import { describe, expect, it } from 'vitest';
import en from '../../../infrastructure/i18n/en.json';

describe('MetricCard content', () => {
  const metrics = en.home.metrics;

  it('has 3 metric cards defined', () => {
    expect(metrics.card1).toBeDefined();
    expect(metrics.card2).toBeDefined();
    expect(metrics.card3).toBeDefined();
  });

  it('each card has value, label, and source', () => {
    for (const key of ['card1', 'card2', 'card3'] as const) {
      const card = metrics[key];
      expect(card.value).toBeTruthy();
      expect(card.label).toBeTruthy();
      expect(card.source).toBeTruthy();
    }
  });

  it('card values are concise enough for display', () => {
    // Values should not wrap on tablet — keep under 20 chars
    expect(metrics.card1.value.length).toBeLessThan(20);
    expect(metrics.card2.value.length).toBeLessThan(20);
    expect(metrics.card3.value.length).toBeLessThan(20);
  });
});
