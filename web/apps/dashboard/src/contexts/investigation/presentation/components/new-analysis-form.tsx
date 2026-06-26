'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { IntegrationType } from '@/contexts/integrations/domain/types';
import {
  INTEGRATION_CATALOG,
  MVP_INTEGRATION_TYPES,
} from '@/contexts/integrations/presentation/components/integration-catalog';
import type { AnalysisSeverity } from '@/contexts/investigation/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { useRouter } from '@/i18n/navigation';

const SEVERITIES: { value: AnalysisSeverity; labelKey: string; colorClass: string }[] = [
  { value: 'low', labelKey: 'low', colorClass: 'text-primary' },
  { value: 'medium', labelKey: 'medium', colorClass: 'text-warning' },
  { value: 'high', labelKey: 'high', colorClass: 'text-warning' },
  { value: 'critical', labelKey: 'critical', colorClass: 'text-destructive' },
];

/** Only MVP integrations are shown as data source options in the analysis form */
const INTEGRATION_OPTIONS = INTEGRATION_CATALOG.filter((e) => MVP_INTEGRATION_TYPES.has(e.type));

interface FormErrors {
  prompt?: string;
}

export function NewAnalysisForm() {
  const t = useTranslations('dashboard.analyses.new');
  const tSeverity = useTranslations('dashboard.analyses.severity');
  const router = useRouter();
  const { addToast } = useToast();

  const [prompt, setPrompt] = useState('');
  const [severity, setSeverity] = useState<AnalysisSeverity | ''>('');
  const [selectedIntegrations, setSelectedIntegrations] = useState<IntegrationType[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!prompt.trim()) {
      newErrors.prompt = t('validation.promptRequired');
    } else if (prompt.trim().length < 10) {
      newErrors.prompt = t('validation.promptTooShort');
    } else if (prompt.length > 4000) {
      newErrors.prompt = t('validation.promptTooLong');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function toggleIntegration(type: IntegrationType) {
    setSelectedIntegrations((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = { prompt: prompt.trim() };
      if (severity) body.severity = severity;
      if (selectedIntegrations.length > 0) body.integrations = selectedIntegrations;

      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        addToast(data.error ?? t('error'), 'error');
        return;
      }

      const data = (await res.json()) as { incidentId?: string; analysis?: { id: string } };
      const id = data.incidentId ?? data.analysis?.id;
      addToast(t('successRedirecting'), 'success');
      if (id) {
        router.push(`/dashboard/incidents/${id}`);
      } else {
        router.push('/dashboard/incidents');
      }
    } catch {
      addToast(t('error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Prompt */}
      <div className="space-y-2">
        <label htmlFor="analysis-prompt" className="block text-sm font-medium text-foreground">
          {t('promptLabel')}
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="analysis-prompt"
          name="prompt"
          rows={6}
          className={[
            'w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow',
            errors.prompt ? 'border-destructive/60 focus:ring-red-400/50' : 'border-border',
          ].join(' ')}
          placeholder={t('promptPlaceholder')}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (errors.prompt) setErrors((prev) => ({ ...prev, prompt: undefined }));
          }}
          disabled={isSubmitting}
          aria-describedby={errors.prompt ? 'prompt-error' : 'prompt-hint'}
          aria-invalid={!!errors.prompt}
        />
        {errors.prompt ? (
          <p id="prompt-error" role="alert" className="text-xs text-destructive">
            {errors.prompt}
          </p>
        ) : (
          <p id="prompt-hint" className="text-xs text-muted-foreground">
            {t('promptHint')}
          </p>
        )}
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <p className="block text-sm font-medium text-foreground">{t('severityLabel')}</p>
        <div className="flex flex-wrap gap-3">
          {SEVERITIES.map(({ value, labelKey, colorClass }) => (
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
              {tSeverity(labelKey as 'low' | 'medium' | 'high' | 'critical')}
            </label>
          ))}
        </div>
      </div>

      {/* Integration Checkboxes */}
      <div className="space-y-2">
        <p className="block text-sm font-medium text-foreground">{t('integrationsLabel')}</p>
        <p className="text-xs text-muted-foreground">{t('integrationsHint')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INTEGRATION_OPTIONS.map(({ type, name, icon, color }) => {
            const checked = selectedIntegrations.includes(type);
            return (
              <label
                key={type}
                className={[
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                  checked
                    ? 'border-primary bg-primary/5 text-foreground font-medium'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground',
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleIntegration(type)}
                  disabled={isSubmitting}
                  className="sr-only"
                  aria-label={name}
                />
                <span
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded overflow-hidden"
                  style={{ backgroundColor: `${color}20` }}
                  aria-hidden="true"
                >
                  <Image
                    src={icon}
                    alt=""
                    width={16}
                    height={16}
                    className="object-contain"
                    unoptimized
                  />
                </span>
                <span className="truncate">{name}</span>
                {checked && (
                  <span className="ml-auto shrink-0 text-primary" aria-hidden="true">
                    ✓
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

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
