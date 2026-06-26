/**
 * Locale resolver for the BusinessProfileFormSchema dialect.
 *
 * Takes a raw schema (LocalizedString values unresolved) and returns a fully
 * resolved copy where every LocalizedString has been flattened to a plain string
 * for the target locale.
 *
 * Rules:
 *   - Plain string → returned as-is.
 *   - Object form → obj[locale], falling back to obj[schema.defaultLocale],
 *     then to the first available key.
 *   - Never throws on missing keys — emits a dev-only warning.
 *   - Field ids, option values, and all non-display fields are never touched.
 */
import type {
  BusinessProfileFormSchema,
  BusinessProfileFormSchemaResolved,
  FormField,
  FormFieldResolved,
  FormOption,
  FormOptionResolved,
  FormStep,
  FormStepResolved,
  LocalizedString,
  SupportedLocale,
} from '../domain/business-profile-types';

// ---------------------------------------------------------------------------
// Core resolver
// ---------------------------------------------------------------------------

function resolveString(
  value: LocalizedString,
  locale: SupportedLocale,
  defaultLocale: SupportedLocale,
  debugPath: string,
): string {
  if (typeof value === 'string') return value;

  // Object form — try target locale, then default, then first available key
  if (value[locale] !== undefined) return value[locale];

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[resolveLocalizedSchema] Missing "${locale}" translation for "${debugPath}". Falling back to "${defaultLocale}".`,
    );
  }

  if (value[defaultLocale] !== undefined) return value[defaultLocale];

  // Last resort: first available key
  const keys = Object.keys(value) as SupportedLocale[];
  if (keys.length > 0) return value[keys[0]] ?? '';

  return '';
}

function resolveOption(
  option: FormOption,
  locale: SupportedLocale,
  defaultLocale: SupportedLocale,
  debugPath: string,
): FormOptionResolved {
  return {
    value: option.value, // machine values are NEVER localized
    label: resolveString(option.label, locale, defaultLocale, `${debugPath}.label`),
  };
}

function resolveField(
  field: FormField,
  locale: SupportedLocale,
  defaultLocale: SupportedLocale,
  stepId: string,
): FormFieldResolved {
  const path = `${stepId}.${field.id}`;
  return {
    id: field.id,
    type: field.type,
    label: resolveString(field.label, locale, defaultLocale, `${path}.label`),
    placeholder:
      field.placeholder !== undefined
        ? resolveString(field.placeholder, locale, defaultLocale, `${path}.placeholder`)
        : undefined,
    help:
      field.help !== undefined
        ? resolveString(field.help, locale, defaultLocale, `${path}.help`)
        : undefined,
    required: field.required,
    minLength: field.minLength,
    maxLength: field.maxLength,
    min: field.min,
    max: field.max,
    options: field.options?.map((opt) => resolveOption(opt, locale, defaultLocale, path)),
    visibleWhen: field.visibleWhen,
  };
}

function resolveStep(
  step: FormStep,
  locale: SupportedLocale,
  defaultLocale: SupportedLocale,
): FormStepResolved {
  const path = `steps.${step.id}`;
  return {
    id: step.id,
    title: resolveString(step.title, locale, defaultLocale, `${path}.title`),
    description:
      step.description !== undefined
        ? resolveString(step.description, locale, defaultLocale, `${path}.description`)
        : undefined,
    fields: step.fields.map((f) => resolveField(f, locale, defaultLocale, step.id)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve all LocalizedString values in the schema to plain strings for `locale`.
 * Falls back gracefully — never throws.
 */
export function resolveLocalizedSchema(
  schema: BusinessProfileFormSchema,
  locale: SupportedLocale,
): BusinessProfileFormSchemaResolved {
  const defaultLocale = schema.defaultLocale;

  return {
    version: schema.version,
    title: resolveString(schema.title, locale, defaultLocale, 'title'),
    subtitle:
      schema.subtitle !== undefined
        ? resolveString(schema.subtitle, locale, defaultLocale, 'subtitle')
        : undefined,
    supportedLocales: schema.supportedLocales,
    defaultLocale: schema.defaultLocale,
    steps: schema.steps.map((s) => resolveStep(s, locale, defaultLocale)),
    submitLabel:
      schema.submitLabel !== undefined
        ? resolveString(schema.submitLabel, locale, defaultLocale, 'submitLabel')
        : undefined,
    skipLabel:
      schema.skipLabel !== undefined
        ? resolveString(schema.skipLabel, locale, defaultLocale, 'skipLabel')
        : undefined,
    markdownTemplate:
      schema.markdownTemplate !== undefined
        ? {
            heading: resolveString(
              schema.markdownTemplate.heading,
              locale,
              defaultLocale,
              'markdownTemplate.heading',
            ),
            sectionPerStep: schema.markdownTemplate.sectionPerStep,
          }
        : undefined,
  };
}
