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
import type { AuditEntry, AuditEvidence } from '@/contexts/audit/domain/types';
import { VALID_ACTIONS, type ValidAction } from '@/contexts/audit/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';

type ActionFilter = 'all' | ValidAction;
type ActorTypeFilter = 'all' | 'user' | 'system';

interface AuditListResponse {
  items: AuditEntry[];
  cursor?: string;
}

function getActionColorClass(action: string): string {
  if (action.startsWith('incident.')) {
    return 'bg-primary/10 text-primary /40';
  }
  if (action.startsWith('remediation.')) {
    return 'bg-muted text-muted-foreground /40';
  }
  if (action.startsWith('approval.')) {
    return 'bg-warning/10 text-warning /40';
  }
  return 'bg-muted text-muted-foreground';
}

function resolveActor(entry: AuditEntry): string {
  if (entry.actorType === 'system') return 'system';
  return entry.actorEmail || entry.actorName || entry.actorId || '';
}

function EvidencesList({ evidences }: { evidences: AuditEvidence[] }) {
  const t = useTranslations('dashboard.audit.evidences');
  const [open, setOpen] = useState(false);

  if (evidences.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {open ? t('hide') : t('show')} ({evidences.length})
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-4 border-l border-border">
          {evidences.map((ev, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: evidences are ordered and not reordered
            <li key={idx} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{ev.type}</span>
              {ev.source && <span className="ml-1 text-muted-foreground/70">({ev.source})</span>}
              {': '}
              {ev.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AuditList() {
  const t = useTranslations('dashboard.audit');
  const tFilters = useTranslations('dashboard.audit.filters');
  const tColumns = useTranslations('dashboard.audit.columns');

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>('all');
  const [error, setError] = useState('');

  const cursorRef = useRef<string | undefined>(undefined);
  cursorRef.current = cursor;

  async function doFetch(opts: { reset?: boolean } = {}) {
    const currentCursor = opts.reset ? undefined : cursorRef.current;

    if (!opts.reset && !currentCursor) return;

    if (opts.reset) {
      setIsLoading(true);
      setCursor(undefined);
      setEntries([]);
    } else {
      setIsLoadingMore(true);
    }
    setError('');

    const params = new URLSearchParams({ limit: '10' });
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (actorTypeFilter !== 'all') params.set('actorType', actorTypeFilter);
    if (currentCursor) params.set('cursor', currentCursor);

    try {
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch audit entries');
      const data = (await res.json()) as AuditListResponse;

      setEntries((prev) => {
        if (opts.reset) return data.items;
        const seen = new Set(prev.map((e) => e.entryId));
        return [...prev, ...data.items.filter((e) => !seen.has(e.entryId))];
      });
      setCursor(data.cursor);
      setHasMore(data.cursor !== undefined);
    } catch {
      setError('Failed to load audit entries. Please refresh the page.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-fetch when server-side filters change; doFetch is intentionally excluded to prevent infinite loops
  useEffect(() => {
    doFetch({ reset: true });
  }, [actionFilter, actorTypeFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="action-filter"
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            {tFilters('actionLabel')}
          </label>
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionFilter)}>
            <SelectTrigger id="action-filter" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tFilters('allActions')}</SelectItem>
              {VALID_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="actor-type-filter"
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            {tFilters('actorTypeLabel')}
          </label>
          <Select
            value={actorTypeFilter}
            onValueChange={(v) => setActorTypeFilter(v as ActorTypeFilter)}
          >
            <SelectTrigger id="actor-type-filter" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tFilters('allActorTypes')}</SelectItem>
              <SelectItem value="user">{tFilters('actorTypeUser')}</SelectItem>
              <SelectItem value="system">{tFilters('actorTypeSystem')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          <output className="sr-only">Loading audit entries...</output>
          <div className="hidden sm:grid sm:grid-cols-5 gap-3 px-4 py-2 rounded-md bg-muted/50">
            {[...Array(5)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items are stable
              <div key={i} className="h-3 rounded bg-muted" />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4">
              <div className="hidden sm:grid sm:grid-cols-5 gap-3 items-center">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-5 w-2/3 rounded-full bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted font-mono" />
              </div>
              <div className="flex flex-col gap-2 sm:hidden">
                <div className="flex justify-between gap-2">
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-5 w-1/3 rounded-full bg-muted" />
                </div>
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
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
      {!isLoading && !error && entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold text-foreground">{t('empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
        </div>
      )}

      {/* Desktop: Table layout */}
      {!isLoading && !error && entries.length > 0 && (
        <>
          {/* Table header — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-5 gap-3 px-4 py-2 rounded-md bg-muted/50">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tColumns('timestamp')}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tColumns('action')}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tColumns('actor')}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tColumns('resource')}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tColumns('hash')}
            </span>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.entryId}
                className="rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-border/80 hover:bg-muted/30"
              >
                {/* Desktop: grid row */}
                <div className="hidden sm:grid sm:grid-cols-5 gap-3 items-start">
                  <span className="text-xs text-muted-foreground tabular-nums pt-0.5">
                    {formatDate(entry.createdAt)}
                  </span>

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium w-fit ${getActionColorClass(entry.action)}`}
                  >
                    {entry.action}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {resolveActor(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{entry.actorType}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground capitalize">
                      {entry.resourceType}
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {entry.resourceId}
                    </p>
                  </div>

                  <span
                    className="text-xs text-muted-foreground font-mono truncate pt-0.5"
                    title={entry.entryHash}
                  >
                    {entry.entryHash.slice(0, 12)}…
                  </span>
                </div>

                {/* Mobile: card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(entry.createdAt)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${getActionColorClass(entry.action)}`}
                    >
                      {entry.action}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium text-foreground">{resolveActor(entry)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {entry.actorType} · {entry.resourceType}:{' '}
                      <span className="font-mono">{entry.resourceId}</span>
                    </p>
                  </div>
                  <p
                    className="text-xs text-muted-foreground font-mono truncate"
                    title={entry.entryHash}
                  >
                    {entry.entryHash.slice(0, 12)}…
                  </p>
                </div>

                {/* Evidences — shown on both layouts when present */}
                {entry.evidences && entry.evidences.length > 0 && (
                  <EvidencesList evidences={entry.evidences} />
                )}
              </div>
            ))}
          </div>
        </>
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
