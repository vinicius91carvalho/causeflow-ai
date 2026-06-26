'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from '@/contexts/investigation/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';
import { Link } from '@/i18n/navigation';
import { SeverityBadge, StatusBadge } from './status-badge';

type StatusFilter = IncidentStatus | 'all';
type SeverityFilter = IncidentSeverity | 'all';

interface IncidentsListResponse {
  incidents: Incident[];
  pagination: { cursor?: string; hasMore: boolean };
}

export function IncidentsList() {
  const t = useTranslations('dashboard.incidents');
  const tStatus = useTranslations('dashboard.incidents.status');
  const tSeverity = useTranslations('dashboard.incidents.severity');
  const tFilters = useTranslations('dashboard.incidents.filters');

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [error, setError] = useState('');

  // Use a ref for cursor to avoid including it in the useEffect dep array
  const cursorRef = useRef<string | undefined>(undefined);
  cursorRef.current = cursor;

  async function doFetch(opts: { reset?: boolean } = {}) {
    const currentCursor = opts.reset ? undefined : cursorRef.current;

    if (opts.reset) {
      setIsLoading(true);
      setCursor(undefined);
      setIncidents([]);
    } else {
      setIsLoadingMore(true);
    }
    setError('');

    const params = new URLSearchParams({ limit: '10' });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (currentCursor) params.set('cursor', currentCursor);

    try {
      const res = await fetch(`/api/analyses?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch incidents');
      const data = (await res.json()) as IncidentsListResponse;

      setIncidents((prev) => (opts.reset ? data.incidents : [...prev, ...data.incidents]));
      setCursor(data.pagination.cursor);
      setHasMore(data.pagination.hasMore);
    } catch {
      setError('Failed to load incidents. Please refresh the page.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  // Fetch on mount and when status filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-fetch on statusFilter change; doFetch is intentionally excluded to prevent infinite loops
  useEffect(() => {
    doFetch({ reset: true });
  }, [statusFilter]);

  // Filter by severity client-side (the API supports status filter server-side)
  const filtered =
    severityFilter === 'all' ? incidents : incidents.filter((i) => i.severity === severityFilter);

  const statuses: IncidentStatus[] = [
    'open',
    'triaging',
    'investigating',
    'awaiting_approval',
    'remediating',
    'resolved',
    'closed',
    'inconclusive',
  ];
  const severities: IncidentSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            {tFilters('status')}:
          </label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger id="status-filter" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tFilters('allStatuses')}</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {tStatus(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="severity-filter"
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            {tFilters('severity')}:
          </label>
          <Select
            value={severityFilter}
            onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
          >
            <SelectTrigger id="severity-filter" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tFilters('allSeverities')}</SelectItem>
              {severities.map((s) => (
                <SelectItem key={s} value={s}>
                  {tSeverity(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          <output className="sr-only">Loading incidents...</output>
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
          <Link
            href="/dashboard/incidents/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + {t('newIncident')}
          </Link>
        </div>
      )}

      {/* Incidents list */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((incident) => (
            <Link
              key={incident.incidentId}
              href={`/dashboard/incidents/${incident.incidentId}`}
              className="group block rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
              aria-label={`View incident: ${incident.title}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: title + meta */}
                <div className="min-w-0 space-y-1.5">
                  <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors">
                    {incident.title}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {incident.sourceProvider && incident.sourceProvider !== 'manual' ? (
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground capitalize">
                        {incident.sourceProvider}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(incident.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Right: badges */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <StatusBadge status={incident.status} />
                  <SeverityBadge severity={incident.severity} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !isLoading && !error && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => doFetch()}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoadingMore && (
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
            {t('loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
