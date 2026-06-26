'use client';

import { cn } from '@causeflow/ui/lib';
import { Input } from '@causeflow/ui/primitives';
import type { FormFieldResolved } from '@/contexts/onboarding/domain/business-profile-types';
import { TagsInput } from './tags-input';

interface FieldRendererProps {
  field: FormFieldResolved;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  allValues: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Visibility helper
// ---------------------------------------------------------------------------

function isVisible(field: FormFieldResolved, allValues: Record<string, unknown>): boolean {
  const { visibleWhen } = field;
  if (!visibleWhen) return true;
  const { fieldId, equals, notEquals, includes } = visibleWhen;
  const v = allValues[fieldId];
  if (equals !== undefined) return v === equals;
  if (notEquals !== undefined) return v !== notEquals;
  if (includes !== undefined && Array.isArray(v)) return v.includes(includes);
  return true;
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

export function FieldRenderer({ field, value, onChange, error, allValues }: FieldRendererProps) {
  if (!isVisible(field, allValues)) return null;

  const id = `field-${field.id}`;
  const strVal = typeof value === 'string' ? value : '';
  const arrVal = Array.isArray(value) ? (value as string[]) : [];
  const numVal = typeof value === 'number' ? value : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </label>

      {/* text / email / url */}
      {(field.type === 'text' || field.type === 'email' || field.type === 'url') && (
        <Input
          id={id}
          type={field.type}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn(error && 'border-destructive')}
        />
      )}

      {/* textarea */}
      {field.type === 'textarea' && (
        <textarea
          id={id}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-ring focus-visible:ring-offset-1 resize-y',
            error && 'border-destructive',
          )}
        />
      )}

      {/* number */}
      {field.type === 'number' && (
        <Input
          id={id}
          type="number"
          value={numVal ?? ''}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          className={cn(error && 'border-destructive')}
        />
      )}

      {/* select */}
      {field.type === 'select' && (
        <select
          id={id}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'focus-visible:ring-offset-1',
            error && 'border-destructive',
          )}
        >
          <option value="">{field.placeholder ?? 'Select…'}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* radio */}
      {field.type === 'radio' && (
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
                strVal === opt.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name={id}
                value={opt.value}
                checked={strVal === opt.value}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  strVal === opt.value ? 'border-primary' : 'border-muted-foreground/50',
                )}
              >
                {strVal === opt.value && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {/* multiselect / checkbox-group */}
      {(field.type === 'multiselect' || field.type === 'checkbox-group') && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {field.options?.map((opt) => {
            const checked = arrVal.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  checked
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-input text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? arrVal.filter((v) => v !== opt.value)
                      : [...arrVal, opt.value];
                    onChange(next);
                  }}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 transition-colors',
                    checked ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                  )}
                >
                  {checked && (
                    <svg
                      className="h-3 w-3 text-primary-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </label>
            );
          })}
        </div>
      )}

      {/* tags */}
      {field.type === 'tags' && (
        <TagsInput value={arrVal} onChange={onChange} placeholder={field.placeholder} />
      )}

      {/* help text */}
      {field.help && !error && <p className="text-xs text-muted-foreground">{field.help}</p>}

      {/* validation error */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
