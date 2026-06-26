'use client';

import { useTranslations } from 'next-intl';
import type { Incident } from '@/contexts/investigation/domain/types';

interface IncidentNarrativeProps {
  incident: Incident;
}

/**
 * Renders the descriptive narrative for an incident — Description, Root
 * Cause, Resolution. Empty sections are omitted entirely so the layout
 * stays dense. Lifecycle timestamps live in the right column inside
 * `<IncidentTimestamps>` to keep this card focused on narrative content.
 */
export function IncidentNarrative({ incident }: IncidentNarrativeProps) {
  const t = useTranslations('dashboard.incidents.detail');

  return (
    <div className="space-y-4 lg:space-y-6">
      {incident.description && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('description')}
          </h3>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {incident.description}
          </p>
        </section>
      )}

      {incident.rootCause && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('rootCause')}
          </h3>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {incident.rootCause}
          </p>
        </section>
      )}

      {incident.resolution && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('resolution')}
          </h3>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {incident.resolution}
          </p>
        </section>
      )}
    </div>
  );
}
