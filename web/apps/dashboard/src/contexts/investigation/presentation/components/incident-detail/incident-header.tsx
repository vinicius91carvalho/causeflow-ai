'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import type { Incident } from '@/contexts/investigation/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';
import { SeverityBadge, StatusBadge } from '../status-badge';

interface IncidentHeaderProps {
  incident: Incident;
  actionBar: ReactNode;
}

export function IncidentHeader({ incident, actionBar }: IncidentHeaderProps) {
  const t = useTranslations('dashboard.incidents.detail');
  const [showDetails, setShowDetails] = useState(false);
  const isManual = !incident.sourceProvider || incident.sourceProvider === 'manual';

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Compact header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-foreground truncate">{incident.title}</h2>
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={incident.severity} />
            {!isManual && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground capitalize">
                {incident.sourceProvider}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDate(incident.createdAt)}
            </span>
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {actionBar}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Details
            <ChevronRight
              className={`h-3 w-3 transition-transform duration-300 ease-in-out${showDetails ? ' rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Collapsible details */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showDetails ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border px-4 py-3 space-y-3">
            {incident.description && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  {t('description')}
                </h4>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {incident.description}
                </p>
              </div>
            )}
            {incident.resolution && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  {t('resolution')}
                </h4>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {incident.resolution}
                </p>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              {t('updatedAt')}: {formatDate(incident.updatedAt)}
              {incident.sourceAlertId && (
                <>
                  {' '}
                  &middot; {t('sourceAlertId')}:{' '}
                  <span className="font-mono">{incident.sourceAlertId}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
