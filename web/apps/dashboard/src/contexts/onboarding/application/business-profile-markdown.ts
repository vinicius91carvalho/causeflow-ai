/**
 * Business Profile Markdown Generator
 *
 * Transforms schema + answers into a deterministic Markdown document.
 *
 * Type-aware formatting:
 *   - text/email/url/number → inline value
 *   - textarea              → blockquote (> ...)
 *   - select/radio          → the label of the chosen option (not raw value)
 *   - multiselect/checkbox-group/tags → bulleted list
 *
 * Safety:
 *   - Empty optional fields omitted entirely (not rendered as "N/A")
 *   - Values escaped: backticks, angle brackets, markdown control chars
 *   - Prompt-injection mitigation: suspicious answers wrapped in fenced code blocks
 */

import type {
  BusinessProfileFormSchema,
  BusinessProfileFormSchemaResolved,
  FormFieldResolved,
  FormStepResolved,
  SupportedLocale,
} from '../domain/business-profile-types';
import { resolveLocalizedSchema } from './resolve-localized-schema';

// ---------------------------------------------------------------------------
// Injection patterns (answers wrapped in fenced block when these appear)
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS = [/<\|/, /\|>/, /`{3}/, /role:/, /system:/, /assistant:/];

function hasInjectionPattern(value: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(value));
}

function escapeMarkdown(value: string): string {
  // Escape backticks and common markdown control chars
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');
}

function sanitizeValue(value: string): string {
  if (hasInjectionPattern(value)) {
    // Wrap in a fenced text block to neutralize injection
    return `\`\`\`text\n${value.replace(/```/g, "'''")}\n\`\`\``;
  }
  return escapeMarkdown(value);
}

// ---------------------------------------------------------------------------
// Per-type formatters
// ---------------------------------------------------------------------------

function formatInline(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return sanitizeValue(String(value));
}

function formatBlockquote(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (!str) return null;
  // Check for injection patterns on the whole string first
  if (hasInjectionPattern(str)) {
    return `\`\`\`text\n${str.replace(/```/g, "'''")}\n\`\`\``;
  }
  const lines = str.split('\n').map((l) => `> ${escapeMarkdown(l)}`);
  return lines.join('\n');
}

function formatBulletList(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const arr = Array.isArray(value) ? value : [value];
  const items = arr.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (items.length === 0) return null;
  return items.map((item) => `- ${sanitizeValue(String(item))}`).join('\n');
}

function getOptionLabel(field: FormFieldResolved, value: unknown): string {
  if (!field.options) return String(value);
  const option = field.options.find((o) => o.value === value);
  return option ? option.label : String(value);
}

function formatFieldValue(field: FormFieldResolved, value: unknown): string | null {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'number':
      return formatInline(value);

    case 'textarea':
      return formatBlockquote(value);

    case 'select':
    case 'radio':
      if (value === null || value === undefined || value === '') return null;
      return sanitizeValue(getOptionLabel(field, value));

    case 'multiselect':
    case 'checkbox-group': {
      if (!Array.isArray(value) || value.length === 0) return null;
      const labels = value.map((v) => getOptionLabel(field, v));
      return formatBulletList(labels);
    }

    case 'tags':
      return formatBulletList(value);

    default:
      return formatInline(value);
  }
}

// ---------------------------------------------------------------------------
// Visibility check
// ---------------------------------------------------------------------------

function isFieldVisible(field: FormFieldResolved, answers: Record<string, unknown>): boolean {
  const { visibleWhen } = field;
  if (!visibleWhen) return true;

  const { fieldId, equals, notEquals, includes } = visibleWhen;
  const fieldValue = answers[fieldId];

  if (equals !== undefined) {
    return fieldValue === equals;
  }
  if (notEquals !== undefined) {
    return fieldValue !== notEquals;
  }
  if (includes !== undefined && Array.isArray(fieldValue)) {
    return fieldValue.includes(includes);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Step renderer
// ---------------------------------------------------------------------------

function renderStep(
  step: FormStepResolved,
  answers: Record<string, unknown>,
  sectionPerStep: boolean,
): string {
  const lines: string[] = [];

  if (sectionPerStep) {
    lines.push(`## ${step.title}`);
    if (step.description) {
      lines.push('');
      lines.push(`*${step.description}*`);
    }
  }

  for (const field of step.fields) {
    if (!isFieldVisible(field, answers)) continue;

    const value = answers[field.id];
    const formatted = formatFieldValue(field, value);
    if (formatted === null) continue; // omit empty optional fields

    lines.push('');
    lines.push(`### ${field.label}`);
    lines.push(formatted);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface GenerateMarkdownMeta {
  submittedAt: string;
  companyName?: string;
  locale: SupportedLocale;
}

/**
 * Generate a deterministic Markdown document from the schema + answers.
 * The schema is first resolved to `locale` so headings and labels match the
 * language the user filled the form in.
 */
export function generateBusinessProfileMarkdown(
  schema: BusinessProfileFormSchema,
  answers: Record<string, unknown>,
  meta: GenerateMarkdownMeta,
): string {
  const resolved: BusinessProfileFormSchemaResolved = resolveLocalizedSchema(schema, meta.locale);

  const heading = resolved.markdownTemplate?.heading ?? 'Company Context';
  const sectionPerStep = resolved.markdownTemplate?.sectionPerStep ?? true;

  const companyName = meta.companyName ?? (answers.companyName as string | undefined) ?? '';
  const titleSuffix = companyName ? ` — ${escapeMarkdown(companyName)}` : '';

  const lines: string[] = [
    `# ${heading}${titleSuffix}`,
    '',
    `_Generated from business profile schemaVersion=${resolved.version} at ${meta.submittedAt}._`,
  ];

  for (const step of resolved.steps) {
    const stepContent = renderStep(step, answers, sectionPerStep);
    if (stepContent.trim()) {
      lines.push('');
      lines.push(stepContent);
    }
  }

  return lines.join('\n');
}
