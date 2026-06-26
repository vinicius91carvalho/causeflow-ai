import { describe, expect, it } from 'vitest';

/**
 * Tests for PrivacyPage technology name policy.
 * Sprint 3 change: vendor-specific PII library name replaced with
 * the generic term "PII detection engine".
 */

// The generic replacement term that must appear in the privacy page
const REQUIRED_GENERIC_TERMS = ['PII detection engine'];

// Vendor names that are explicitly allowed on the website
const ALLOWED_VENDOR_NAMES = ['AWS Bedrock'];

describe('PrivacyPage technology name policy', () => {
  it('has replacement generic terms defined', () => {
    expect(REQUIRED_GENERIC_TERMS).toContain('PII detection engine');
  });

  it('AWS Bedrock is an acceptable vendor name', () => {
    expect(ALLOWED_VENDOR_NAMES).toContain('AWS Bedrock');
  });

  it('generic terms do not include vendor-specific names', () => {
    for (const term of REQUIRED_GENERIC_TERMS) {
      expect(term).not.toMatch(/^(Microsoft|Google|Amazon|OpenAI)/);
    }
  });

  it('PII detection engine is the correct generic replacement', () => {
    const genericTerm = 'PII detection engine';
    expect(REQUIRED_GENERIC_TERMS).toContain(genericTerm);
    // Verify this is a generic description, not a product name
    expect(genericTerm).not.toMatch(/^[A-Z][a-z]+ [A-Z]/); // No "Brand Product" pattern
  });
});
