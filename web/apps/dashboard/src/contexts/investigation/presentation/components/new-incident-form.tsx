'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useIsStaff } from '@/contexts/identity/presentation/hooks/use-is-staff';
import type {
  IncidentSeverity,
  InvestigationModeName,
} from '@/contexts/investigation/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { useRouter } from '@/i18n/navigation';
import { InvestigationModeSelector } from './incident-detail/investigation-mode-selector';

const SEVERITIES: { value: IncidentSeverity; colorClass: string }[] = [
  { value: 'critical', colorClass: 'text-destructive' },
  { value: 'high', colorClass: 'text-warning' },
  { value: 'medium', colorClass: 'text-warning' },
  { value: 'low', colorClass: 'text-primary' },
  { value: 'info', colorClass: 'text-muted-foreground' },
];

interface FormErrors {
  title?: string;
  description?: string;
  severity?: string;
}

export function NewIncidentForm() {
  const t = useTranslations('dashboard.incidents.new.form');
  const tSeverity = useTranslations('dashboard.incidents.severity');
  const router = useRouter();
  const { addToast } = useToast();
  const isStaff = useIsStaff();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity | ''>('');
  const [investigationMode, setInvestigationMode] = useState<InvestigationModeName>('orchestrator');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Incident title is required';
    } else if (title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    } else if (title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }
    if (!severity) {
      newErrors.severity = 'Severity is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        severity,
      };
      // Staff-only: stamp the reasoning strategy at creation time so the
      // dispatcher routes to the chosen mode when the investigation kicks
      // off. BFF + Core API both silently drop this field for non-staff.
      if (isStaff && investigationMode !== 'orchestrator') {
        body.investigationMode = investigationMode;
      }

      // Prefer POST /api/incidents (AC-022 credits ledger + Core persist).
      // Fall back to /api/analyses which shares the same createIncident client.
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; code?: string };
        if (res.status === 402 || data.code === 'CREDITS_EXHAUSTED') {
          addToast('Credits exhausted. Free plan allows 3 analyses per month.', 'error');
          return;
        }
        addToast(data.error ?? 'Failed to create incident. Please try again.', 'error');
        return;
      }

      const data = (await res.json()) as { incidentId?: string; incident?: { incidentId: string } };
      const incidentId = data.incidentId ?? data.incident?.incidentId;
      addToast('Incident created! Redirecting...', 'success');
      if (incidentId) {
        router.push(`/dashboard/incidents/${incidentId}`);
      } else {
        router.push('/dashboard/incidents');
      }
    } catch {
      addToast('Failed to create incident. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <label htmlFor="incident-title" className="block text-sm font-medium text-foreground">
          {t('title')}
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="incident-title"
          name="title"
          type="text"
          className={[
            'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow',
            errors.title ? 'border-destructive/60 focus:ring-red-400/50' : 'border-border',
          ].join(' ')}
          placeholder={t('titlePlaceholder')}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          disabled={isSubmitting}
          aria-describedby={errors.title ? 'title-error' : undefined}
          aria-invalid={!!errors.title}
        />
        {errors.title && (
          <p id="title-error" role="alert" className="text-xs text-destructive">
            {errors.title}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="incident-description" className="block text-sm font-medium text-foreground">
          {t('description')}
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="incident-description"
          name="description"
          rows={8}
          className={[
            'w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow',
            errors.description ? 'border-destructive/60' : 'border-border',
          ].join(' ')}
          placeholder={t('descriptionPlaceholder')}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          disabled={isSubmitting}
          aria-describedby={errors.description ? 'description-error' : undefined}
          aria-invalid={!!errors.description}
          required
        />
        {errors.description && (
          <p id="description-error" role="alert" className="text-xs text-destructive">
            {errors.description}
          </p>
        )}
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <p className="block text-sm font-medium text-foreground">
          {t('severity')}
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </p>
        <div className="flex flex-wrap gap-3">
          {SEVERITIES.map(({ value, colorClass }) => (
            <label
              key={value}
              className={[
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                severity === value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground',
                isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <input
                type="radio"
                name="severity"
                value={value}
                checked={severity === value}
                onChange={() => setSeverity(value)}
                disabled={isSubmitting}
                className="sr-only"
              />
              <span className={colorClass} aria-hidden="true">
                ●
              </span>
              {tSeverity(value)}
            </label>
          ))}
        </div>
        {errors.severity && (
          <p role="alert" className="text-xs text-destructive">
            {errors.severity}
          </p>
        )}
      </div>

      {/* Staff-only: pre-select the investigation mode so the dispatcher
          picks it up once the investigation kicks off. Tenant users
          never see this block (gated by useIsStaff). */}
      {isStaff && (
        <div className="space-y-2">
          <p className="block text-sm font-medium text-foreground">Investigation mode</p>
          <InvestigationModeSelector value={investigationMode} onChange={setInvestigationMode} />
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting && (
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
