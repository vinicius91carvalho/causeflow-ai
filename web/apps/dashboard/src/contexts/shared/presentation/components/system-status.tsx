'use client';

import { cn } from '@causeflow/ui/lib';
import { AlertCircle, CheckCircle2, MinusCircle, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { HealthStatus } from '@/lib/api/core-api-types';

// ─── Status helpers ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'ok' | 'degraded' | 'down' }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full shrink-0',
        status === 'ok' && 'bg-success/50',
        status === 'degraded' && 'bg-warning/50',
        status === 'down' && 'bg-destructive/50',
      )}
      aria-hidden="true"
    />
  );
}

function StatusBadge({ status, label }: { status: 'ok' | 'degraded' | 'down'; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        status === 'ok' && 'bg-success/10 text-success /40',
        status === 'degraded' && 'bg-warning/10 text-warning /40',
        status === 'down' && 'bg-destructive/10 text-destructive /40',
      )}
    >
      <StatusDot status={status} />
      {label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function SystemStatusSkeleton() {
  return (
    <output
      className="rounded-lg border border-border bg-card p-4 shadow-sm animate-pulse block"
      aria-busy="true"
      aria-label="Loading system status"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-6 w-16 rounded-full bg-muted" />
      </div>
      <div className="h-3 w-32 rounded bg-muted" />
    </output>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

/**
 * SystemStatus renders a lightweight liveness card backed by `/api/health`.
 *
 * Per PRD (dashboard-redesign-core-api, sprint 01), this component intentionally
 * calls the lightweight liveness endpoint, NOT the verbose dependency-tree one.
 * Deep system health lives in the dedicated SystemHealthSection (Sprint 4).
 *
 * INVARIANT: this file must contain `'/api/health'` exactly once and MUST NOT
 * reference the detailed variant. Enforced by `check-invariants.sh`.
 */
export function SystemStatus() {
  const t = useTranslations('dashboard.systemStatus');
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as HealthStatus;
      setData(result);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return <SystemStatusSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Server className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('error')}</span>
        </div>
      </div>
    );
  }

  const statusLabel =
    data.status === 'ok' ? t('ok') : data.status === 'degraded' ? t('degraded') : t('down');

  const StatusIcon =
    data.status === 'ok' ? CheckCircle2 : data.status === 'degraded' ? MinusCircle : AlertCircle;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              data.status === 'ok' && 'text-success',
              data.status === 'degraded' && 'text-warning',
              data.status === 'down' && 'text-destructive',
            )}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        </div>
        <StatusBadge status={data.status} label={statusLabel} />
      </div>

      {/* API Version */}
      <p className="text-xs text-muted-foreground">
        {t('version')}: <span className="font-mono text-foreground">{data.version}</span>
      </p>
    </div>
  );
}
