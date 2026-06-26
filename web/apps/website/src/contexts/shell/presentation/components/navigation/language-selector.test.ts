import { describe, expect, it } from 'vitest';

/**
 * Tests for language selector toggle logic.
 * The component toggles between 'en' and 'pt-br' locales.
 */

function getNextLocale(current: string): string {
  return current === 'en' ? 'pt-br' : 'en';
}

function getDisplayLabel(locale: string): string {
  return locale === 'en' ? 'PT-BR' : 'EN';
}

describe('Language selector logic', () => {
  it('toggles from EN to PT-BR', () => {
    expect(getNextLocale('en')).toBe('pt-br');
  });

  it('toggles from PT-BR to EN', () => {
    expect(getNextLocale('pt-br')).toBe('en');
  });

  it('displays PT-BR label when current locale is EN', () => {
    expect(getDisplayLabel('en')).toBe('PT-BR');
  });

  it('displays EN label when current locale is PT-BR', () => {
    expect(getDisplayLabel('pt-br')).toBe('EN');
  });

  it('handles unknown locale by defaulting to EN', () => {
    // Unknown locale falls through to 'en' (same as else branch)
    expect(getNextLocale('fr')).toBe('en');
    expect(getDisplayLabel('fr')).toBe('EN');
  });
});
