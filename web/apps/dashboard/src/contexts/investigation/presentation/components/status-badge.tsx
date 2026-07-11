'use client';

import { useTranslations } from 'next-intl';
import type { IncidentSeverity, IncidentStatus } from '@/contexts/investigation/domain/types';

interface StatusBadgeProps {
  status: IncidentStatus;
}

interface SeverityBadgeProps {
  severity: IncidentSeverity;
}

const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium';

const statusClasses: Record<IncidentStatus, string> = {
  open: `${BADGE_BASE} border-warning/40 bg-warning/10 text-warning`,
  triaging: `${BADGE_BASE} border-[hsl(var(--brand-purple))]/40 bg-[hsl(var(--brand-purple))]/10 text-[hsl(var(--brand-purple))]`,
  investigating: `${BADGE_BASE} border-primary/40 bg-primary/10 text-primary`,
  awaiting_approval: `${BADGE_BASE} border-warning/40 bg-warning/10 text-warning`,
  remediating: `${BADGE_BASE} border-accent/40 bg-accent/10 text-accent`,
  resolved: `${BADGE_BASE} border-success/40 bg-success/10 text-success`,
  closed: `${BADGE_BASE} border-border bg-muted text-muted-foreground`,
  inconclusive: `${BADGE_BASE} border-warning/40 bg-warning/10 text-warning`,
};

const SEV_BASE = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium';

const severityClasses: Record<IncidentSeverity, string> = {
  critical: `${SEV_BASE} border-destructive/40 bg-destructive/10 text-destructive`,
  high: `${SEV_BASE} border-warning/40 bg-warning/10 text-warning`,
  medium: `${SEV_BASE} border-[hsl(var(--brand-purple))]/40 bg-[hsl(var(--brand-purple))]/10 text-[hsl(var(--brand-purple))]`,
  low: `${SEV_BASE} border-success/40 bg-success/10 text-success`,
  info: `${SEV_BASE} border-border bg-muted text-muted-foreground`,
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const t = useTranslations('dashboard.incidents.status');

  return (
    <span className={statusClasses[status]}>
      {status === 'investigating' && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary/50" aria-hidden="true" />
      )}
      {status === 'triaging' && (
        <span className="h-1.5 w-1.5 rounded-full bg-accent/50" aria-hidden="true" />
      )}
      {t(status)}
    </span>
  );
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const t = useTranslations('dashboard.incidents.severity');

  return (
    <span data-testid="incident-severity" className={severityClasses[severity]}>
      {t(severity)}
    </span>
  );
}
