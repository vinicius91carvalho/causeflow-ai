'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Remediation, RemediationStatus } from '@/contexts/investigation/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';
import { Link } from '@/i18n/navigation';
import { RemediationStatusBadge } from './remediation-status-badge';

type StatusFilter = RemediationStatus | 'all';

interface RemediationsListProps {
  incidentId?: string;
}

export function RemediationsList({ incidentId }: RemediationsListProps) {
  const t = useTranslations('dashboard.remediations');
  const tStatus = useTranslations('dashboard.remediations.status');

  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    async function fetchRemediations() {
      setIsLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (incidentId) params.set('incidentId', incidentId);

      try {
        const res = await fetch(`/api/remediations?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch remediations');
        const data = (await res.json()) as { remediations: Remediation[] };
        setRemediations(data.remediations);
      } catch {
        setError('Failed to load remediations. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRemediations();
  }, [incidentId]);

  const statuses: RemediationStatus[] = [
    'proposed',
    'approved',
    'rejected',
    'executing',
    'completed',
    'failed',
  ];

  const filtered =
    statusFilter === 'all' ? remediations : remediations.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="remediation-status-filter"
          className="text-sm text-muted-foreground whitespace-nowrap"
        >
          Status:
        </label>
        <select
          id="remediation-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          <output className="sr-only">Loading remediations...</output>
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-5 w-20 rounded-full bg-muted" />
              </div>
              <div className="mt-2 h-3 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold text-foreground">{t('empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
        </div>
      )}

      {/* Remediations list */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((remediation) => (
            <Link
              key={remediation.remediationId}
              href={`/dashboard/remediations/${remediation.remediationId}`}
              className="group block rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
              aria-label={`View remediation: ${remediation.description}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: description + meta */}
                <div className="min-w-0 space-y-1.5">
                  <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {remediation.description}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/dashboard/incidents/${remediation.incidentId}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Incident: {remediation.incidentId}
                    </Link>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{remediation.proposedBy}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(remediation.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Right: status badge */}
                <div className="shrink-0">
                  <RemediationStatusBadge
                    status={remediation.status}
                    label={tStatus(remediation.status)}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
