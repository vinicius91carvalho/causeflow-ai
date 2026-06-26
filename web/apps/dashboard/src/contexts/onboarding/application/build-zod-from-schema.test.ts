import { describe, expect, it } from 'vitest';
import type { FormFieldResolved, FormStepResolved } from '../domain/business-profile-types';
import { buildZodSchemaForStep } from './build-zod-from-schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(fields: FormFieldResolved[]): FormStepResolved {
  return { id: 'test-step', title: 'Test Step', fields };
}

function field(
  overrides: Partial<FormFieldResolved> & { id: string; type: FormFieldResolved['type'] },
): FormFieldResolved {
  return {
    label: overrides.id,
    ...overrides,
  } as FormFieldResolved;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildZodSchemaForStep', () => {
  it('required text field fails when empty', () => {
    const step = makeStep([field({ id: 'name', type: 'text', required: true })]);
    const schema = buildZodSchemaForStep(step, {});
    const result = schema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('required text field passes when non-empty', () => {
    const step = makeStep([field({ id: 'name', type: 'text', required: true })]);
    const schema = buildZodSchemaForStep(step, {});
    const result = schema.safeParse({ name: 'Acme' });
    expect(result.success).toBe(true);
  });

  it('optional text field passes when absent', () => {
    const step = makeStep([field({ id: 'notes', type: 'text', required: false })]);
    const schema = buildZodSchemaForStep(step, {});
    const result = schema.safeParse({ notes: undefined });
    expect(result.success).toBe(true);
  });

  it('enforces minLength constraint', () => {
    const step = makeStep([field({ id: 'desc', type: 'textarea', required: true, minLength: 10 })]);
    const schema = buildZodSchemaForStep(step, {});
    expect(schema.safeParse({ desc: 'short' }).success).toBe(false);
    expect(schema.safeParse({ desc: 'long enough here' }).success).toBe(true);
  });

  it('enforces maxLength constraint', () => {
    const step = makeStep([field({ id: 'desc', type: 'text', required: false, maxLength: 5 })]);
    const schema = buildZodSchemaForStep(step, {});
    expect(schema.safeParse({ desc: 'toolong' }).success).toBe(false);
    expect(schema.safeParse({ desc: 'ok' }).success).toBe(true);
  });

  it('required select field fails when empty string', () => {
    const step = makeStep([field({ id: 'industry', type: 'select', required: true })]);
    const schema = buildZodSchemaForStep(step, {});
    expect(schema.safeParse({ industry: '' }).success).toBe(false);
    expect(schema.safeParse({ industry: 'saas' }).success).toBe(true);
  });

  it('required multiselect field fails when empty array', () => {
    const step = makeStep([field({ id: 'providers', type: 'multiselect', required: true })]);
    const schema = buildZodSchemaForStep(step, {});
    expect(schema.safeParse({ providers: [] }).success).toBe(false);
    expect(schema.safeParse({ providers: ['aws'] }).success).toBe(true);
  });

  it('required tags field fails when empty array', () => {
    const step = makeStep([field({ id: 'names', type: 'tags', required: true })]);
    const schema = buildZodSchemaForStep(step, {});
    expect(schema.safeParse({ names: [] }).success).toBe(false);
  });

  it('required radio field fails when empty', () => {
    const step = makeStep([field({ id: 'size', type: 'radio', required: true })]);
    const schema = buildZodSchemaForStep(step, {});
    expect(schema.safeParse({ size: '' }).success).toBe(false);
    expect(schema.safeParse({ size: '11-50' }).success).toBe(true);
  });

  it('skips validation for hidden required field (visibleWhen not met)', () => {
    const nameField = field({ id: 'name', type: 'text', required: true });
    const conditionalField = field({
      id: 'industryOther',
      type: 'text',
      required: true,
      visibleWhen: { fieldId: 'industry', equals: 'other' },
    });
    const step = makeStep([nameField, conditionalField]);
    // industry !== 'other' → conditional field is hidden → should not fail validation
    const schema = buildZodSchemaForStep(step, { industry: 'saas', name: 'Acme' });
    const result = schema.safeParse({ name: 'Acme', industryOther: undefined });
    expect(result.success).toBe(true);
  });

  it('validates hidden field is required when visibleWhen IS met', () => {
    const conditionalField = field({
      id: 'industryOther',
      type: 'text',
      required: true,
      visibleWhen: { fieldId: 'industry', equals: 'other' },
    });
    const step = makeStep([conditionalField]);
    // industry === 'other' → field is visible → must be filled
    const schema = buildZodSchemaForStep(step, { industry: 'other' });
    const result = schema.safeParse({ industryOther: '' });
    expect(result.success).toBe(false);
  });

  it('number field enforces min/max', () => {
    const step = makeStep([
      field({ id: 'count', type: 'number', required: true, min: 1, max: 100 }),
    ]);
    const schema = buildZodSchemaForStep(step, {});
    expect(schema.safeParse({ count: 0 }).success).toBe(false);
    expect(schema.safeParse({ count: 101 }).success).toBe(false);
    expect(schema.safeParse({ count: 50 }).success).toBe(true);
  });
});
