'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Incident, IncidentStatus } from '@/contexts/investigation/domain/types';

interface RootCauseCardProps {
  incident: Incident;
}

const INVESTIGATING_STATUSES: ReadonlySet<IncidentStatus> = new Set<IncidentStatus>([
  'triaging',
  'investigating',
]);

const COLLAPSE_CHAR_THRESHOLD = 320;

export function RootCauseCard({ incident }: RootCauseCardProps) {
  const t = useTranslations('dashboard.incidents.detail');
  const [expanded, setExpanded] = useState(false);

  const rootCause = incident.rootCause?.trim();
  const hasRootCause = Boolean(rootCause);
  const isInvestigating = INVESTIGATING_STATUSES.has(incident.status);

  if (!hasRootCause && !isInvestigating) return null;

  if (!hasRootCause) {
    return (
      <section
        data-testid="incident-root-cause"
        data-state="investigating"
        aria-live="polite"
        className="rounded-xl border border-dashed border-primary/40 bg-primary/10/50 p-4 shadow-sm /20"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-primary">{t('rootCauseInvestigating')}</h3>
        </div>
        <p className="mt-1 text-xs text-primary/80 /80">{t('rootCauseInvestigatingHint')}</p>
      </section>
    );
  }

  const isLong = (rootCause as string).length > COLLAPSE_CHAR_THRESHOLD;

  const cardClasses = 'border-border bg-muted/60 /30';
  const badgeClasses = 'border-success/60 bg-success/10 text-success';

  return (
    <section
      data-testid="incident-root-cause"
      data-state="identified"
      className={`rounded-xl border p-5 shadow-sm ${cardClasses}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeClasses}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('rootCauseIdentified')}
        </span>
      </div>
      <p
        data-testid="incident-root-cause-text"
        className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground ${
          isLong && !expanded ? 'line-clamp-4' : ''
        }`}
      >
        {rootCause}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 text-xs font-medium text-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {expanded ? t('showLess') : t('showMore')}
        </button>
      )}
    </section>
  );
}
