/**
 * Type-level tests for business-profile-types.
 * These verify that the TypeScript types compile correctly and have the expected shape.
 */
import { describe, expect, it } from 'vitest';
import type {
  BusinessProfile,
  FieldType,
  FormField,
  FormFieldResolved,
  FormOptionResolved,
  FormStepResolved,
  HindsightStatus,
  LocalizedString,
  SupportedLocale,
} from './business-profile-types';

describe('business-profile-types', () => {
  it('SupportedLocale accepts en and pt-br', () => {
    const en: SupportedLocale = 'en';
    const ptBr: SupportedLocale = 'pt-br';
    expect(en).toBe('en');
    expect(ptBr).toBe('pt-br');
  });

  it('LocalizedString can be a plain string', () => {
    const plain: LocalizedString = 'Hello';
    expect(typeof plain).toBe('string');
  });

  it('LocalizedString can be an object with en and pt-br', () => {
    const localized: LocalizedString = { en: 'Hello', 'pt-br': 'Olá' };
    expect(typeof localized).toBe('object');
    if (typeof localized === 'object') {
      expect(localized.en).toBe('Hello');
      expect(localized['pt-br']).toBe('Olá');
    }
  });

  it('HindsightStatus covers all expected values', () => {
    const pending: HindsightStatus = 'pending';
    const sent: HindsightStatus = 'sent';
    const failed: HindsightStatus = 'failed';
    expect([pending, sent, failed]).toEqual(['pending', 'sent', 'failed']);
  });

  it('BusinessProfile has all required fields', () => {
    const profile: BusinessProfile = {
      tenantId: 't1',
      schemaVersion: 'v1',
      locale: 'en',
      answers: { companyName: 'Acme' },
      markdown: '# Acme',
      submittedAt: '2026-04-08T00:00:00Z',
      skippedAt: null,
      submittedBy: 'u1',
      hindsightStatus: 'sent',
      hindsightSentAt: '2026-04-08T00:00:01Z',
      hindsightError: null,
    };
    expect(profile.tenantId).toBe('t1');
    expect(profile.locale).toBe('en');
  });

  it('FormField visibleWhen is optional', () => {
    const field: FormField = {
      id: 'f1',
      type: 'text',
      label: 'Label',
    };
    expect(field.visibleWhen).toBeUndefined();
  });

  it('all FieldType values are strings', () => {
    const types: FieldType[] = [
      'text',
      'textarea',
      'email',
      'url',
      'number',
      'select',
      'multiselect',
      'radio',
      'checkbox-group',
      'tags',
    ];
    for (const t of types) {
      expect(typeof t).toBe('string');
    }
  });

  it('resolved schema types have string (not LocalizedString) labels', () => {
    const resolved: FormFieldResolved = {
      id: 'f1',
      type: 'text',
      label: 'Plain string label',
    };
    expect(typeof resolved.label).toBe('string');

    const resolvedOption: FormOptionResolved = { value: 'saas', label: 'B2B SaaS' };
    expect(typeof resolvedOption.label).toBe('string');

    const resolvedStep: FormStepResolved = {
      id: 's1',
      title: 'Step title',
      fields: [resolved],
    };
    expect(typeof resolvedStep.title).toBe('string');
  });
});
