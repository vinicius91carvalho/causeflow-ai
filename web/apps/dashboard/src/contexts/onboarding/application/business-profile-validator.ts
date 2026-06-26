/**
 * Business Profile Answer Validator
 *
 * Validates user-submitted answers against a (raw, unresolved) schema.
 * Honors required, minLength, maxLength, min, max, and visibleWhen
 * (hidden fields are never required — they cannot fail validation).
 *
 * Works against field ids and constraints only; does not care about labels.
 */
import type { BusinessProfileFormSchema, FormField } from '../domain/business-profile-types';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Visibility check (mirrors the renderer's logic, label-free)
// ---------------------------------------------------------------------------

function isFieldVisible(field: FormField, answers: Record<string, unknown>): boolean {
  const { visibleWhen } = field;
  if (!visibleWhen) return true;

  const { fieldId, equals, notEquals, includes } = visibleWhen;
  const value = answers[fieldId];

  if (equals !== undefined) return value === equals;
  if (notEquals !== undefined) return value !== notEquals;
  if (includes !== undefined && Array.isArray(value)) return value.includes(includes);
  return true;
}

// ---------------------------------------------------------------------------
// Per-field validators
// ---------------------------------------------------------------------------

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function validateField(field: FormField, answers: Record<string, unknown>): string | null {
  if (!isFieldVisible(field, answers)) return null; // hidden → always valid

  const value = answers[field.id];

  // required check
  if (field.required && isEmpty(value)) {
    return 'This field is required.';
  }

  if (isEmpty(value)) return null; // optional and empty — nothing more to check

  // string-based constraints
  if (typeof value === 'string') {
    if (field.minLength !== undefined && value.length < field.minLength) {
      return `Must be at least ${field.minLength} characters.`;
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      return `Must be at most ${field.maxLength} characters.`;
    }
  }

  // array-based constraints (tags / multiselect)
  if (Array.isArray(value)) {
    // No length constraints defined for arrays in the schema dialect yet.
    // Placeholder for future min/max items support.
  }

  // numeric constraints
  if (field.type === 'number' && typeof value === 'number') {
    if (field.min !== undefined && value < field.min) {
      return `Must be at least ${field.min}.`;
    }
    if (field.max !== undefined && value > field.max) {
      return `Must be at most ${field.max}.`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate all answers against the schema.
 *
 * @param schema  Raw (unresolved) schema.
 * @param answers User-submitted answers keyed by field id.
 * @returns { valid, errors } — errors keyed by field id.
 */
export function validateAnswers(
  schema: BusinessProfileFormSchema,
  answers: Record<string, unknown>,
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const step of schema.steps) {
    for (const field of step.fields) {
      const error = validateField(field, answers);
      if (error) {
        errors[field.id] = error;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
