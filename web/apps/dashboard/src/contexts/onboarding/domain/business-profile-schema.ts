/**
 * BusinessProfileFormSchema zod validator
 *
 * Validates the form schema dialect defined in PRD §6.1.
 * Enforces:
 *   - LocalizedString: plain string OR object with both `en` and `pt-br` keys
 *   - Unique field ids across all steps
 *   - visibleWhen.fieldId references a real field in the schema
 *   - Only recognized FieldTypes
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const supportedLocaleSchema = z.enum(['en', 'pt-br']);

/** LocalizedString: plain string OR { en: string; 'pt-br': string } */
const localizedStringSchema = z.union([
  z.string(),
  z
    .object({
      en: z.string().min(1),
      'pt-br': z.string().min(1),
    })
    .strict(),
]);

const fieldTypeSchema = z.enum([
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
]);

const formOptionSchema = z.object({
  value: z.string(),
  label: localizedStringSchema,
});

const visibleWhenSchema = z.object({
  fieldId: z.string(),
  equals: z.union([z.string(), z.number(), z.boolean()]).optional(),
  notEquals: z.union([z.string(), z.number(), z.boolean()]).optional(),
  includes: z.string().optional(),
});

const formFieldSchema = z.object({
  id: z.string().min(1),
  type: fieldTypeSchema,
  label: localizedStringSchema,
  placeholder: localizedStringSchema.optional(),
  help: localizedStringSchema.optional(),
  required: z.boolean().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  options: z.array(formOptionSchema).optional(),
  visibleWhen: visibleWhenSchema.optional(),
});

const formStepSchema = z.object({
  id: z.string().min(1),
  title: localizedStringSchema,
  description: localizedStringSchema.optional(),
  fields: z.array(formFieldSchema),
});

const markdownTemplateSchema = z.object({
  heading: localizedStringSchema,
  sectionPerStep: z.boolean(),
});

// ---------------------------------------------------------------------------
// Cross-field validation
// ---------------------------------------------------------------------------

function collectFieldIds(steps: z.infer<typeof formStepSchema>[]): string[] {
  return steps.flatMap((s) => s.fields.map((f) => f.id));
}

function hasDuplicates(ids: string[]): string | null {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}

/**
 * Zod validator for the entire BusinessProfileFormSchema.
 * Uses `.superRefine` for cross-field checks.
 */
export const businessProfileFormSchemaValidator = z
  .object({
    version: z.string().min(1),
    title: localizedStringSchema,
    subtitle: localizedStringSchema.optional(),
    supportedLocales: z.array(supportedLocaleSchema).min(1),
    defaultLocale: supportedLocaleSchema,
    steps: z.array(formStepSchema),
    submitLabel: localizedStringSchema.optional(),
    skipLabel: localizedStringSchema.optional(),
    markdownTemplate: markdownTemplateSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const allIds = collectFieldIds(data.steps);

    // Check for duplicate field IDs
    const duplicate = hasDuplicates(allIds);
    if (duplicate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate field id "${duplicate}" found across steps`,
        path: ['steps'],
      });
    }

    // Check that visibleWhen.fieldId references a real field
    const idSet = new Set(allIds);
    for (const step of data.steps) {
      for (const field of step.fields) {
        if (field.visibleWhen && !idSet.has(field.visibleWhen.fieldId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Field "${field.id}" has visibleWhen referencing unknown fieldId "${field.visibleWhen.fieldId}"`,
            path: ['steps'],
          });
        }
      }
    }
  });

export type BusinessProfileFormSchemaInput = z.input<typeof businessProfileFormSchemaValidator>;
