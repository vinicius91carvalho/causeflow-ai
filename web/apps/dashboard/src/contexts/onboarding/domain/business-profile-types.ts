/**
 * Business Profile Domain Types
 *
 * Covers the schema dialect, resolved types, and the BusinessProfile entity.
 * No framework imports — pure domain.
 */

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

export type SupportedLocale = 'en' | 'pt-br';

// ---------------------------------------------------------------------------
// Localized strings
// ---------------------------------------------------------------------------

/**
 * A user-facing string that can be:
 * - A plain string (locale-agnostic fallback)
 * - An object with explicit translations per supported locale
 */
export type LocalizedString = string | { en: string; 'pt-br': string };

// ---------------------------------------------------------------------------
// Field types
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'url'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox-group'
  | 'tags';

// ---------------------------------------------------------------------------
// Schema types (raw — LocalizedString is not yet resolved)
// ---------------------------------------------------------------------------

export interface FormOption {
  /** Machine value — NEVER localized */
  value: string;
  /** Display label */
  label: LocalizedString;
}

export interface FormField {
  /** Unique across the whole form */
  id: string;
  type: FieldType;
  label: LocalizedString;
  placeholder?: LocalizedString;
  /** Muted hint text */
  help?: LocalizedString;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** For select/radio/multiselect/checkbox-group */
  options?: FormOption[];
  /** Simple conditional visibility */
  visibleWhen?: {
    fieldId: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
    /** For multiselect/tags */
    includes?: string;
  };
}

export interface FormStep {
  id: string;
  title: LocalizedString;
  description?: LocalizedString;
  fields: FormField[];
}

export interface BusinessProfileFormSchema {
  version: string;
  title: LocalizedString;
  subtitle?: LocalizedString;
  supportedLocales: SupportedLocale[];
  defaultLocale: SupportedLocale;
  steps: FormStep[];
  submitLabel?: LocalizedString;
  skipLabel?: LocalizedString;
  markdownTemplate?: {
    heading: LocalizedString;
    sectionPerStep: boolean;
  };
}

// ---------------------------------------------------------------------------
// Resolved types — LocalizedString flattened to plain string
// ---------------------------------------------------------------------------

export interface FormOptionResolved {
  value: string;
  label: string;
}

export interface FormFieldResolved {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: FormOptionResolved[];
  visibleWhen?: FormField['visibleWhen'];
}

export interface FormStepResolved {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldResolved[];
}

export interface BusinessProfileFormSchemaResolved {
  version: string;
  title: string;
  subtitle?: string;
  supportedLocales: SupportedLocale[];
  defaultLocale: SupportedLocale;
  steps: FormStepResolved[];
  submitLabel?: string;
  skipLabel?: string;
  markdownTemplate?: {
    heading: string;
    sectionPerStep: boolean;
  };
}

// ---------------------------------------------------------------------------
// BusinessProfile entity
// ---------------------------------------------------------------------------

export type HindsightStatus = 'pending' | 'sent' | 'failed';

export interface BusinessProfile {
  tenantId: string;
  /** Matches the JSON schema file version (e.g. "v1") */
  schemaVersion: string;
  /** Locale the profile was filled in — drives Markdown output language */
  locale: SupportedLocale;
  /** Keyed by field id from the schema */
  answers: Record<string, unknown>;
  /** Generated at submit time (audit trail); written in `locale` */
  markdown: string;
  submittedAt: string | null;
  skippedAt: string | null;
  submittedBy: string;
  hindsightStatus: HindsightStatus;
  hindsightSentAt: string | null;
  hindsightError: string | null;
}
