/**
 * Tests for the BusinessProfileFormSchema zod validator.
 */
import { describe, expect, it } from 'vitest';
import v1Schema from '../infrastructure/business-profile-schemas/v1.json';
import { businessProfileFormSchemaValidator } from './business-profile-schema';

describe('businessProfileFormSchemaValidator', () => {
  it('parses a fully-bilingual v1.json schema', () => {
    const result = businessProfileFormSchemaValidator.safeParse(v1Schema);
    expect(result.success).toBe(true);
  });

  it('accepts plain string LocalizedString values', () => {
    const schema = {
      version: 'test',
      title: 'Simple title',
      supportedLocales: ['en'],
      defaultLocale: 'en',
      steps: [
        {
          id: 'step1',
          title: 'Step 1',
          fields: [{ id: 'name', type: 'text', label: 'Name', required: true }],
        },
      ],
    };
    const result = businessProfileFormSchemaValidator.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('rejects object LocalizedString missing pt-br', () => {
    const schema = {
      version: 'test',
      title: { en: 'Title' }, // missing pt-br
      supportedLocales: ['en', 'pt-br'],
      defaultLocale: 'en',
      steps: [],
    };
    const result = businessProfileFormSchemaValidator.safeParse(schema);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain('pt-br');
  });

  it('rejects duplicate field ids across steps', () => {
    const schema = {
      version: 'test',
      title: { en: 'T', 'pt-br': 'T' },
      supportedLocales: ['en', 'pt-br'],
      defaultLocale: 'en',
      steps: [
        {
          id: 'step1',
          title: { en: 'S1', 'pt-br': 'S1' },
          fields: [{ id: 'duplicate', type: 'text', label: { en: 'L', 'pt-br': 'L' } }],
        },
        {
          id: 'step2',
          title: { en: 'S2', 'pt-br': 'S2' },
          fields: [{ id: 'duplicate', type: 'text', label: { en: 'L', 'pt-br': 'L' } }],
        },
      ],
    };
    const result = businessProfileFormSchemaValidator.safeParse(schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.message;
      expect(msg).toMatch(/duplicate/i);
    }
  });

  it('rejects visibleWhen.fieldId referencing a non-existent field', () => {
    const schema = {
      version: 'test',
      title: { en: 'T', 'pt-br': 'T' },
      supportedLocales: ['en', 'pt-br'],
      defaultLocale: 'en',
      steps: [
        {
          id: 'step1',
          title: { en: 'S1', 'pt-br': 'S1' },
          fields: [
            {
              id: 'field1',
              type: 'text',
              label: { en: 'L', 'pt-br': 'L' },
              visibleWhen: { fieldId: 'nonExistentField', equals: 'value' },
            },
          ],
        },
      ],
    };
    const result = businessProfileFormSchemaValidator.safeParse(schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/nonExistentField|visibleWhen/i);
    }
  });

  it('rejects unknown field type', () => {
    const schema = {
      version: 'test',
      title: { en: 'T', 'pt-br': 'T' },
      supportedLocales: ['en', 'pt-br'],
      defaultLocale: 'en',
      steps: [
        {
          id: 'step1',
          title: { en: 'S1', 'pt-br': 'S1' },
          fields: [{ id: 'f1', type: 'unknown-type', label: { en: 'L', 'pt-br': 'L' } }],
        },
      ],
    };
    const result = businessProfileFormSchemaValidator.safeParse(schema);
    expect(result.success).toBe(false);
  });

  it('validates that v1.json has both en and pt-br in supportedLocales', () => {
    expect(v1Schema.supportedLocales).toContain('en');
    expect(v1Schema.supportedLocales).toContain('pt-br');
  });

  it('validates that all object-form LocalizedStrings in v1 have both en and pt-br keys', () => {
    // Walk v1 schema and check every object-form LocalizedString
    function walkSchema(obj: unknown): void {
      if (typeof obj !== 'object' || obj === null) return;
      if (Array.isArray(obj)) {
        for (const item of obj) walkSchema(item);
        return;
      }
      const record = obj as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        // Skip non-user-facing fields
        if (['version', 'value', 'fieldId', 'id', 'type'].includes(key)) continue;
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          ('en' in value || 'pt-br' in value)
        ) {
          // This looks like a LocalizedString object
          expect(value).toHaveProperty('en');
          expect(value).toHaveProperty('pt-br');
          const localized = value as { en: unknown; 'pt-br': unknown };
          expect(typeof localized.en).toBe('string');
          expect((localized.en as string).length).toBeGreaterThan(0);
          expect(typeof localized['pt-br']).toBe('string');
          expect((localized['pt-br'] as string).length).toBeGreaterThan(0);
        } else {
          walkSchema(value);
        }
      }
    }
    walkSchema(v1Schema);
  });
});
