'use client';

import { ChevronRight, ShieldAlert } from 'lucide-react';
import type { Incident } from '@/contexts/investigation/domain/types';
import {
  SeverityBadge,
  StatusBadge,
} from '@/contexts/investigation/presentation/components/status-badge';
import { Link } from '@/i18n/navigation';

// ─── Skeleton ─────────────────────────────────────────────────────────────

function RecentAnalysesSkeleton() {
  return (
    <output
      className="rounded-lg border border-border bg-card block"
      aria-busy="true"
      aria-label="Loading incidents"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        <div className="h-3 w-14 rounded bg-muted animate-pulse" />
      </div>
      <ul className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable ids
          <li key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-3.5 w-3/4 rounded bg-muted" />
              <div className="h-2.5 w-1/2 rounded bg-muted" />
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="h-5 w-14 rounded-full bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </output>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────

interface RecentAnalysesProps {
  incidents: Incident[];
  loading?: boolean;
  heading: string;
  viewAllLabel: string;
  emptyLabel: string;
}

// ─── Main component ────────────────────────────────────────────────────────

export function RecentAnalyses({
  incidents,
  loading = false,
  heading,
  viewAllLabel,
  emptyLabel,
}: RecentAnalysesProps) {
  if (loading) {
    return <RecentAnalysesSkeleton />;
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
        </div>
        <Link
          href="/dashboard/incidents"
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          {viewAllLabel}
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Empty state */}
      {incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/40 mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border" aria-label={heading}>
          {incidents.map((incident) => {
            const formattedDate = new Date(incident.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
            const titlePreview =
              incident.title.length > 80 ? `${incident.title.slice(0, 80)}…` : incident.title;

            return (
              <li key={incident.incidentId}>
                <Link
                  href={`/dashboard/incidents/${incident.incidentId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors group"
                >
                  {/* Title preview */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {titlePreview}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={incident.status} />
                    <SeverityBadge severity={incident.severity} />
                  </div>

                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
