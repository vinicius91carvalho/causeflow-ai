/**
 * Tests for business-profile-validator.
 */
import { describe, expect, it } from 'vitest';
import type { BusinessProfileFormSchema } from '../domain/business-profile-types';
import { validateAnswers } from './business-profile-validator';

const schema: BusinessProfileFormSchema = {
  version: 'v1',
  title: 'Test',
  supportedLocales: ['en', 'pt-br'],
  defaultLocale: 'en',
  steps: [
    {
      id: 'step1',
      title: 'Step 1',
      fields: [
        { id: 'name', type: 'text', label: 'Name', required: true, minLength: 3, maxLength: 50 },
        { id: 'email', type: 'email', label: 'Email', required: true },
        { id: 'age', type: 'number', label: 'Age', min: 18, max: 120 },
        {
          id: 'industry',
          type: 'select',
          label: 'Industry',
          required: true,
          options: [
            { value: 'saas', label: 'SaaS' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'industryOther',
          type: 'text',
          label: 'Describe your industry',
          required: true,
          visibleWhen: { fieldId: 'industry', equals: 'other' },
        },
      ],
    },
    {
      id: 'step2',
      title: 'Step 2',
      fields: [
        {
          id: 'tags',
          type: 'tags',
          label: 'Tags',
          required: false,
        },
        {
          id: 'notes',
          type: 'textarea',
          label: 'Notes',
          required: false,
          maxLength: 500,
        },
      ],
    },
  ],
};

describe('validateAnswers', () => {
  it('returns valid when all required fields are provided', () => {
    const result = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'saas',
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('returns error when required field is missing', () => {
    const result = validateAnswers(schema, {
      email: 'test@example.com',
      industry: 'saas',
      // name missing
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('name');
  });

  it('enforces minLength constraint', () => {
    const result = validateAnswers(schema, {
      name: 'ab', // too short (min 3)
      email: 'test@example.com',
      industry: 'saas',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('name');
  });

  it('enforces maxLength constraint', () => {
    const result = validateAnswers(schema, {
      name: 'a'.repeat(51), // too long (max 50)
      email: 'test@example.com',
      industry: 'saas',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('name');
  });

  it('enforces min/max for number fields', () => {
    const tooYoung = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'saas',
      age: 17,
    });
    expect(tooYoung.valid).toBe(false);
    expect(tooYoung.errors).toHaveProperty('age');

    const tooOld = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'saas',
      age: 121,
    });
    expect(tooOld.valid).toBe(false);
    expect(tooOld.errors).toHaveProperty('age');

    const valid = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'saas',
      age: 25,
    });
    expect(valid.valid).toBe(true);
  });

  it('skips hidden required field (visibleWhen not met)', () => {
    // industry !== 'other', so industryOther is hidden → not required
    const result = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'saas',
      // industryOther intentionally omitted
    });
    expect(result.valid).toBe(true);
    expect(result.errors).not.toHaveProperty('industryOther');
  });

  it('requires hidden field when visibleWhen IS met', () => {
    // industry === 'other', so industryOther is visible and required
    const result = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'other',
      // industryOther missing
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('industryOther');
  });

  it('accepts industryOther when industry=other and value provided', () => {
    const result = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'other',
      industryOther: 'Custom industry',
    });
    expect(result.valid).toBe(true);
  });

  it('ignores optional fields that are missing', () => {
    const result = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'saas',
      // tags and notes are optional — omitted
    });
    expect(result.valid).toBe(true);
    expect(result.errors).not.toHaveProperty('tags');
    expect(result.errors).not.toHaveProperty('notes');
  });

  it('enforces maxLength on optional textarea when provided', () => {
    const result = validateAnswers(schema, {
      name: 'Acme',
      email: 'test@example.com',
      industry: 'saas',
      notes: 'a'.repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('notes');
  });
});
