'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Incident } from '@/contexts/investigation/domain/types';

interface IncidentInconclusivePanelProps {
  incident: Incident;
}

/**
 * Displayed when an incident reaches `inconclusive` status.
 * Uses warning semantic tokens (amber-tinted in light mode via CSS vars) —
 * visually distinct from `failed` (destructive/red) and `resolved` (success/green).
 */
export function IncidentInconclusivePanel({ incident }: IncidentInconclusivePanelProps) {
  const t = useTranslations('dashboard.incidents.detail.inconclusive');

  return (
    <section
      aria-label={t('headline')}
      className="rounded-xl border border-warning/40 bg-warning/10 p-6 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <h2 className="text-base font-semibold leading-snug text-warning">{t('headline')}</h2>
      </div>

      {/* Explanation */}
      <p className="mt-3 text-sm leading-relaxed text-foreground/80">{t('body')}</p>

      {/* Suggested next steps */}
      <div className="mt-4">
        <h3 className="text-sm font-medium text-foreground">{t('nextStepsTitle')}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/70">
          <li>{t('nextStep1')}</li>
          <li>{t('nextStep2')}</li>
          <li>{t('nextStep3')}</li>
        </ul>
      </div>

      {/* Resolution reason (if present) */}
      {incident.resolution && (
        <p className="mt-4 text-xs text-muted-foreground">
          <span className="font-medium">{t('reasonLabel')}:</span>{' '}
          <span className="font-mono">{incident.resolution}</span>
        </p>
      )}
    </section>
  );
}
