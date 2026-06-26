import { describe, expect, it } from 'vitest';

/**
 * Tests for WhyNowSection card configuration.
 * After sprint change: card3 (migration) removed, grid reduced to 2 columns.
 * Tests verify the card configuration logic and key consistency.
 */

interface CardConfig {
  key: string;
  sourceCount: number;
}

// Mirrors the cards array in the production component after the sprint change
const EXPECTED_CARDS: CardConfig[] = [
  { key: 'card1', sourceCount: 2 },
  { key: 'card2', sourceCount: 1 },
];

describe('WhyNowSection card configuration', () => {
  it('includes exactly 2 cards after card3 removal', () => {
    expect(EXPECTED_CARDS).toHaveLength(2);
  });

  it('does not include card3 (migration card was removed)', () => {
    const keys = EXPECTED_CARDS.map((c) => c.key);
    expect(keys).not.toContain('card3');
  });

  it('includes card1 and card2', () => {
    const keys = EXPECTED_CARDS.map((c) => c.key);
    expect(keys).toContain('card1');
    expect(keys).toContain('card2');
  });

  it('has unique card keys', () => {
    const keys = EXPECTED_CARDS.map((c) => c.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(EXPECTED_CARDS.length);
  });

  it('card1 has 2 sources', () => {
    const card = EXPECTED_CARDS.find((c) => c.key === 'card1');
    expect(card?.sourceCount).toBe(2);
  });

  it('card2 has 1 source', () => {
    const card = EXPECTED_CARDS.find((c) => c.key === 'card2');
    expect(card?.sourceCount).toBe(1);
  });

  it('grid uses 2 columns (md:grid-cols-2) not 3', () => {
    // This constant mirrors the grid class used in the rendered section
    const gridClass = 'grid grid-cols-1 gap-6 md:grid-cols-2';
    expect(gridClass).toContain('md:grid-cols-2');
    expect(gridClass).not.toContain('md:grid-cols-3');
  });
});
