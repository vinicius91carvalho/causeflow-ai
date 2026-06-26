'use client';

import { cn } from '@causeflow/ui/lib';
import { AlertTriangle, CreditCard, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';

interface CreditsBannerProps {
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  renewDate?: string;
  upgradeLabel: string;
  renewsLabel: string;
  creditsRemainingLabel: string;
  warningLabel: string;
  criticalLabel: string;
  loading?: boolean;
}

function CreditsBannerSkeleton() {
  return (
    <output
      className="rounded-lg border border-border bg-card p-4 animate-pulse block"
      aria-busy="true"
      aria-label="Loading credits"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-2 w-full rounded-full bg-muted" />
          </div>
        </div>
        <div className="h-7 w-28 rounded bg-muted shrink-0" />
      </div>
    </output>
  );
}

export function CreditsBanner({
  creditsTotal,
  creditsUsed,
  creditsRemaining,
  renewDate,
  upgradeLabel,
  renewsLabel,
  creditsRemainingLabel,
  warningLabel,
  criticalLabel,
  loading = false,
}: CreditsBannerProps) {
  if (loading) {
    return <CreditsBannerSkeleton />;
  }

  const percentUsed = creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;
  const percentRemaining = 100 - percentUsed;
  const isCritical = percentRemaining < 5;
  const isWarning = !isCritical && percentRemaining < 20;

  const formattedRenewDate = renewDate
    ? new Date(renewDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <section
      className={cn(
        'rounded-lg border p-4 transition-colors',
        isCritical
          ? 'border-destructive/40 bg-destructive/10 /50 /20'
          : isWarning
            ? 'border-warning/40 bg-warning/10 /50 /20'
            : 'border-border bg-card',
      )}
      aria-label="Credits status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: icon + info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              isCritical
                ? 'bg-destructive/10 text-destructive /40'
                : isWarning
                  ? 'bg-warning/10 text-warning /40'
                  : 'bg-brand-green/10 text-brand-green',
            )}
          >
            {isCritical || isWarning ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                isCritical ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground',
              )}
            >
              {isCritical
                ? criticalLabel
                : isWarning
                  ? warningLabel
                  : creditsRemainingLabel.replace('{count}', String(creditsRemaining))}
              {formattedRenewDate && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  — {renewsLabel.replace('{date}', formattedRenewDate)}
                </span>
              )}
            </p>
            {/* Progress bar */}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isCritical ? 'bg-destructive/50' : isWarning ? 'bg-warning/50' : 'bg-brand-green',
                )}
                style={{ width: `${percentRemaining.toFixed(1)}%` }}
                role="progressbar"
                aria-valuenow={creditsRemaining}
                aria-valuemin={0}
                aria-valuemax={creditsTotal}
                aria-label={`${creditsRemaining} of ${creditsTotal} credits remaining`}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {creditsUsed} / {creditsTotal} used
            </p>
          </div>
        </div>

        {/* Right: upgrade link */}
        <Link
          href="/dashboard/billing"
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            isCritical
              ? 'bg-destructive/80 text-white hover:bg-destructive/80 dark:hover:bg-destructive/80'
              : isWarning
                ? 'bg-warning/80 text-white hover:bg-warning/80 dark:hover:bg-warning/80'
                : 'bg-brand-purple text-white hover:bg-brand-purple/90',
          )}
        >
          <TrendingUp className="h-3 w-3" aria-hidden="true" />
          {upgradeLabel}
        </Link>
      </div>
    </section>
  );
}

export { CreditsBannerSkeleton };
