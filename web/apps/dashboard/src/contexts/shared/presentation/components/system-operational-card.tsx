'use client';

import { cn } from '@causeflow/ui/lib';
import { AlertCircle, CheckCircle2, MinusCircle, Plug, Plus, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { HealthStatus } from '@/lib/api/core-api-types';

interface SystemOperationalCardMessages {
  title: string;
  newAnalysis: string;
  integrations: string;
  version: string;
  ok: string;
  degraded: string;
  down: string;
  error: string;
}

interface SystemOperationalCardProps {
  integrationCount: number;
  messages: SystemOperationalCardMessages;
}

function CardSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading system status"
      className="rounded-lg border border-border bg-card p-4 shadow-sm animate-pulse block"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-6 w-20 rounded-full bg-muted" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="h-8 w-32 rounded bg-muted" />
      </div>
    </output>
  );
}

export function SystemOperationalCard({ integrationCount, messages }: SystemOperationalCardProps) {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        const res = await fetch('/api/health', { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HealthStatus;
        setData(json);
        setError(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
    return () => controller.abort();
  }, []);

  if (loading) return <CardSkeleton />;

  const statusLabel = data
    ? data.status === 'ok'
      ? messages.ok
      : data.status === 'degraded'
        ? messages.degraded
        : messages.down
    : null;

  const StatusIcon = data
    ? data.status === 'ok'
      ? CheckCircle2
      : data.status === 'degraded'
        ? MinusCircle
        : AlertCircle
    : Server;

  return (
    <div
      data-testid="system-operational-card"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              !data || error
                ? 'text-muted-foreground'
                : data.status === 'ok'
                  ? 'text-success'
                  : data.status === 'degraded'
                    ? 'text-warning'
                    : 'text-destructive',
            )}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-foreground">{messages.title}</h2>
        </div>

        {error ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-destructive/10 text-destructive">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {messages.error}
          </span>
        ) : statusLabel && data ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              data.status === 'ok' && 'bg-success/10 text-success /40',
              data.status === 'degraded' && 'bg-warning/10 text-warning /40',
              data.status === 'down' && 'bg-destructive/10 text-destructive /40',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                data.status === 'ok' && 'bg-success/50',
                data.status === 'degraded' && 'bg-warning/50',
                data.status === 'down' && 'bg-destructive/50',
              )}
              aria-hidden="true"
            />
            {statusLabel}
          </span>
        ) : null}
      </div>

      {/* Footer row: integration count + CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Plug className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            <span className="font-semibold text-foreground">{integrationCount}</span>{' '}
            {messages.integrations}
          </span>
        </div>

        <Link
          href="/dashboard/analyses/new"
          data-testid="cta-new-analysis"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {messages.newAnalysis}
        </Link>
      </div>

      {/* Version sub-line */}
      {data && !error && (
        <p className="mt-2 text-xs text-muted-foreground">
          {messages.version}: <span className="font-mono text-foreground">{data.version}</span>
        </p>
      )}
    </div>
  );
}
