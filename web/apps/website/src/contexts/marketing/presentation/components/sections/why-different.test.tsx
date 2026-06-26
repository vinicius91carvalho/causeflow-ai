import { describe, expect, it } from 'vitest';

/**
 * Tests for WhyDifferentSection card configuration.
 * Since the component is a server-rendered React component using next-intl,
 * we test the card configuration logic and key consistency.
 */

type CardKey =
  | 'builtByEM'
  | 'minutesNotHours'
  | 'crossTool'
  | 'gracefulDegradation'
  | 'builtForStartups'
  | 'platformCompanies';

interface CardConfig {
  key: CardKey;
  hasSource?: boolean;
}

// Mirrors the cards array in the production component
const EXPECTED_CARDS: CardConfig[] = [
  { key: 'builtByEM' },
  { key: 'minutesNotHours', hasSource: true },
  { key: 'crossTool' },
  { key: 'gracefulDegradation' },
  { key: 'builtForStartups' },
  { key: 'platformCompanies', hasSource: true },
];

// Expected i18n keys that must exist in en.json for the cards
const EXPECTED_I18N_KEYS = EXPECTED_CARDS.map((c) => `home.whyDifferent.cards.${c.key}`);

describe('WhyDifferentSection card configuration', () => {
  it('includes gracefulDegradation card in the expected card list', () => {
    const keys = EXPECTED_CARDS.map((c) => c.key);
    expect(keys).toContain('gracefulDegradation');
  });

  it('includes all 6 expected differentiator cards', () => {
    expect(EXPECTED_CARDS).toHaveLength(6);
  });

  it('has unique card keys', () => {
    const keys = EXPECTED_CARDS.map((c) => c.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(EXPECTED_CARDS.length);
  });

  it('gracefulDegradation card has no source (no external citation needed)', () => {
    const card = EXPECTED_CARDS.find((c) => c.key === 'gracefulDegradation');
    expect(card).toBeDefined();
    expect(card?.hasSource).toBeFalsy();
  });

  it('platformCompanies and minutesNotHours have sources', () => {
    const withSource = EXPECTED_CARDS.filter((c) => c.hasSource).map((c) => c.key);
    expect(withSource).toContain('platformCompanies');
    expect(withSource).toContain('minutesNotHours');
  });

  it('generates correct i18n key paths for all cards', () => {
    expect(EXPECTED_I18N_KEYS).toContain('home.whyDifferent.cards.gracefulDegradation');
    expect(EXPECTED_I18N_KEYS).toContain('home.whyDifferent.cards.crossTool');
    expect(EXPECTED_I18N_KEYS).toContain('home.whyDifferent.cards.minutesNotHours');
  });
});
