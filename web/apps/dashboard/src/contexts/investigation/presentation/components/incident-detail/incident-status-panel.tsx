'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { Incident } from '@/contexts/investigation/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';
import { SeverityBadge, StatusBadge } from '../status-badge';

interface IncidentStatusPanelProps {
  incident: Incident;
  /** Action buttons rendered inline so the parent can keep handler ownership. */
  actionBar: ReactNode;
}

/** Status panel for the incident detail page. */
export function IncidentStatusPanel({ incident, actionBar }: IncidentStatusPanelProps) {
  const t = useTranslations('dashboard.incidents.detail');
  const isManual = !incident.sourceProvider || incident.sourceProvider === 'manual';

  return (
    <aside className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Title */}
      <h2 className="text-lg font-semibold leading-snug text-foreground">{incident.title}</h2>

      {/* Status / severity / source / created */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={incident.status} />
        <SeverityBadge severity={incident.severity} />
        {isManual ? (
          <span className="text-xs text-muted-foreground">{t('sourceManual')}</span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground capitalize">
            {t('sourceWebhook', { provider: incident.sourceProvider })}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('createdAt')}: {formatDate(incident.createdAt)}
      </p>

      {/* Action bar (passed in by parent so handler ownership stays in IncidentDetail) */}
      <div className="pt-1">{actionBar}</div>
    </aside>
  );
}
