'use client';

import { cn } from '@causeflow/ui/lib';
import { Activity, BarChart3, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BillingMessages, UsageHistoryData } from './billing-types';

// ---------------------------------------------------------------------------
// Usage skeleton
// ---------------------------------------------------------------------------

export function UsageHistorySkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 animate-pulse" aria-hidden="true">
      <div className="h-5 w-32 rounded bg-muted mb-4" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-6 h-32 rounded bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function UsageProgressBar({
  label,
  used,
  limit,
  icon: Icon,
}: {
  label: string;
  used: number;
  limit: number;
  icon: typeof Activity;
}) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {label}
        </span>
        <span
          className={cn(
            'text-xs font-medium',
            isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-muted-foreground',
          )}
        >
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isAtLimit ? 'bg-destructive/50' : isNearLimit ? 'bg-warning/50' : 'bg-primary',
          )}
          style={{ width: `${percent.toFixed(1)}%` }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-label={`${label}: ${used} of ${limit}`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini bar chart (last 30 days)
// ---------------------------------------------------------------------------

function MiniBarChart({
  daily,
  messages,
}: {
  daily: Array<{ date: string; investigations: number; events: number }>;
  messages: BillingMessages;
}) {
  if (!daily || daily.length === 0) return null;

  const maxInv = Math.max(...daily.map((d) => d.investigations), 1);

  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-muted-foreground mb-2">{messages.last30Days}</p>
      <div className="flex items-end gap-[2px] h-20">
        {daily.map((day) => {
          const height = Math.max((day.investigations / maxInv) * 100, 2);
          return (
            <div
              key={day.date}
              className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors cursor-default"
              style={{ height: `${height}%` }}
              title={`${day.date}: ${day.investigations} inv, ${day.events} events`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage History section
// ---------------------------------------------------------------------------

export function UsageHistory({
  messages,
  onBuyMore,
}: {
  messages: BillingMessages;
  onBuyMore: () => void;
}) {
  const [usage, setUsage] = useState<UsageHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchUsage() {
      try {
        const res = await fetch('/api/billing/usage-history?days=30');
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as UsageHistoryData;
          setUsage(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <UsageHistorySkeleton />;
  if (!usage) return null;

  const invPercent =
    usage.investigations.limit > 0
      ? (usage.investigations.used / usage.investigations.limit) * 100
      : 0;
  const evtPercent = usage.events.limit > 0 ? (usage.events.used / usage.events.limit) * 100 : 0;
  const showBuyMore = invPercent >= 80 || evtPercent >= 80;

  return (
    <section
      className="rounded-lg border border-border bg-card p-6"
      aria-label={messages.usageHistory}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {messages.usageHistory}
        </h2>
        {showBuyMore && (
          <button
            type="button"
            onClick={onBuyMore}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
            )}
          >
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            {messages.buyMore}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UsageProgressBar
          label={messages.investigationsUsed}
          used={usage.investigations.used}
          limit={usage.investigations.limit}
          icon={Activity}
        />
        <UsageProgressBar
          label={messages.eventsProcessed}
          used={usage.events.used}
          limit={usage.events.limit}
          icon={BarChart3}
        />
      </div>

      <MiniBarChart daily={usage.daily} messages={messages} />
    </section>
  );
}
