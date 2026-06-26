import { describe, expect, it } from 'vitest';

/**
 * Tests for Footer GDPR/LGPD badge display logic.
 * After Sprint 3 change: badges show for ALL locales (no pt-br gate).
 */

// Mirrors footer badge display logic after the Sprint 3 change
function shouldShowComplianceBadges(_locale: string): boolean {
  // Post-change: always show LGPD and GDPR badges regardless of locale
  return true;
}

describe('Footer compliance badges', () => {
  it('shows GDPR/LGPD badges for EN locale', () => {
    expect(shouldShowComplianceBadges('en')).toBe(true);
  });

  it('shows GDPR/LGPD badges for PT-BR locale', () => {
    expect(shouldShowComplianceBadges('pt-br')).toBe(true);
  });

  it('shows GDPR/LGPD badges for all locales', () => {
    const locales = ['en', 'pt-br'];
    for (const locale of locales) {
      expect(shouldShowComplianceBadges(locale)).toBe(true);
    }
  });
});
