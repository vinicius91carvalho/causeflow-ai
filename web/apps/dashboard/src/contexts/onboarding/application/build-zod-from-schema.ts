/**
 * Dynamic Zod schema builder for a single wizard step.
 *
 * Generates a Zod schema from a resolved FormStep that:
 *  - Respects `required`, `minLength`, `maxLength`, `min`, `max` constraints
 *  - Skips validation for fields hidden by `visibleWhen` given current form values
 *  - Uses locale-resolved labels for error messages (so feedback is in the user's language)
 */
import { z } from 'zod';
import type { FormFieldResolved, FormStepResolved } from '../domain/business-profile-types';

// ---------------------------------------------------------------------------
// Visibility check
// ---------------------------------------------------------------------------

function isVisible(field: FormFieldResolved, allValues: Record<string, unknown>): boolean {
  const { visibleWhen } = field;
  if (!visibleWhen) return true;

  const { fieldId, equals, notEquals, includes } = visibleWhen;
  const value = allValues[fieldId];

  if (equals !== undefined) return value === equals;
  if (notEquals !== undefined) return value !== notEquals;
  if (includes !== undefined && Array.isArray(value)) return value.includes(includes);
  return true;
}

// ---------------------------------------------------------------------------
// Per-field Zod builder
// ---------------------------------------------------------------------------

function buildFieldSchema(
  field: FormFieldResolved,
  allValues: Record<string, unknown>,
): z.ZodTypeAny {
  const visible = isVisible(field, allValues);

  // Hidden fields are entirely optional — pass-through any value
  if (!visible) {
    return z.unknown().optional();
  }

  const { type, required, minLength, maxLength, min, max, label } = field;

  const requiredMsg = `${label} is required.`;

  switch (type) {
    case 'number': {
      let schema = z.number({ invalid_type_error: `${label} must be a number.` });
      if (min !== undefined) schema = schema.min(min, { message: `Must be at least ${min}.` });
      if (max !== undefined) schema = schema.max(max, { message: `Must be at most ${max}.` });
      if (!required) return schema.optional();
      return schema;
    }

    case 'multiselect':
    case 'checkbox-group':
    case 'tags': {
      const arr = z.array(z.string());
      if (required) return arr.min(1, { message: requiredMsg });
      return arr.optional().default([]);
    }

    case 'radio':
    case 'select': {
      if (required) {
        return z.string().min(1, { message: requiredMsg });
      }
      return z.string().optional();
    }

    // text-like: text, textarea, email, url
    default: {
      let schema = z.string();
      if (required) {
        schema = schema.min(1, { message: requiredMsg });
      }
      if (minLength !== undefined) {
        schema = schema.min(minLength, {
          message: `Must be at least ${minLength} characters.`,
        });
      }
      if (maxLength !== undefined) {
        schema = schema.max(maxLength, {
          message: `Must be at most ${maxLength} characters.`,
        });
      }
      if (!required) return schema.optional();
      return schema;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Zod object schema for a single resolved step.
 *
 * @param step       Resolved (locale-flattened) form step.
 * @param allValues  Current form values across ALL steps (needed for visibleWhen evaluation).
 * @returns A `z.ZodObject` that validates the step's fields.
 */
export function buildZodSchemaForStep(
  step: FormStepResolved,
  allValues: Record<string, unknown>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of step.fields) {
    shape[field.id] = buildFieldSchema(field, allValues);
  }
  return z.object(shape);
}
