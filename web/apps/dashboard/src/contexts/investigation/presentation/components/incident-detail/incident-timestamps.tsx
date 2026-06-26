'use client';

import { useTranslations } from 'next-intl';
import type { Incident } from '@/contexts/investigation/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';

interface IncidentTimestampsProps {
  incident: Incident;
}

/**
 * Compact timestamps card for the incident detail right column. Shows the
 * key lifecycle dates (created, updated, resolved) plus the source alert id
 * when present. Designed to live next to the IncidentStatusPanel.
 */
export function IncidentTimestamps({ incident }: IncidentTimestampsProps) {
  const t = useTranslations('dashboard.incidents.detail');

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('timestamps')}
      </h3>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">{t('createdAt')}:</dt>
          <dd className="text-foreground">{formatDate(incident.createdAt)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">{t('updatedAt')}:</dt>
          <dd className="text-foreground">{formatDate(incident.updatedAt)}</dd>
        </div>
        {incident.resolvedAt && (
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">{t('resolvedAt')}:</dt>
            <dd className="text-foreground">{formatDate(incident.resolvedAt)}</dd>
          </div>
        )}
        {incident.sourceAlertId && (
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">{t('sourceAlertId')}:</dt>
            <dd className="font-mono text-xs text-foreground">{incident.sourceAlertId}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
