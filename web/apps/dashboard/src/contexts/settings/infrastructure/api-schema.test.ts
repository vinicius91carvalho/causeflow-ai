/**
 * Contract tests for updateSettingsSchema — ensures locale is validated as a
 * strict enum (security contract from PRD §13) and other fields behave as documented.
 */

import { describe, expect, it } from 'vitest';
import { updateSettingsSchema } from './api-schema';

describe('updateSettingsSchema', () => {
  describe('locale field', () => {
    it('accepts "en"', () => {
      const result = updateSettingsSchema.safeParse({ locale: 'en' });
      expect(result.success).toBe(true);
    });

    it('accepts "pt-br"', () => {
      const result = updateSettingsSchema.safeParse({ locale: 'pt-br' });
      expect(result.success).toBe(true);
    });

    it('rejects unknown locale strings (security contract: no forward-pass of arbitrary values)', () => {
      const result = updateSettingsSchema.safeParse({ locale: 'fr' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = updateSettingsSchema.safeParse({ locale: '' });
      expect(result.success).toBe(false);
    });

    it('is optional — omitting locale is valid', () => {
      const result = updateSettingsSchema.safeParse({ theme: 'dark' });
      expect(result.success).toBe(true);
    });
  });

  describe('theme field', () => {
    it('accepts valid theme values', () => {
      for (const theme of ['light', 'dark', 'system']) {
        expect(updateSettingsSchema.safeParse({ theme }).success).toBe(true);
      }
    });

    it('rejects unknown theme', () => {
      expect(updateSettingsSchema.safeParse({ theme: 'pink' }).success).toBe(false);
    });
  });
});
