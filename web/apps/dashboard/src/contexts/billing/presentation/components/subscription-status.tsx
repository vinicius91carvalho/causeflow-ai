'use client';

import { cn } from '@causeflow/ui/lib';
import { AlertTriangle, CreditCard } from 'lucide-react';
import type { BillingMessages, SubscriptionData } from './billing-types';

// ---------------------------------------------------------------------------
// Credits skeleton
// ---------------------------------------------------------------------------

export function CreditsSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-1.5 w-full rounded-full bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credits bar
// ---------------------------------------------------------------------------

export function CreditsBar({
  subscription,
  messages,
}: {
  subscription: SubscriptionData;
  messages: BillingMessages;
}) {
  const { creditsTotal, creditsUsed, creditsRemaining, currentPeriodEnd } = subscription;
  const isUnlimited = creditsTotal < 0;

  if (isUnlimited) {
    return (
      <section className="rounded-lg border border-border bg-card p-4" aria-label="Credits status">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">{messages.creditsUnlimited}</p>
        </div>
      </section>
    );
  }

  const percentRemaining = creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0;
  const isCritical = percentRemaining < 5;
  const isWarning = !isCritical && percentRemaining < 20;

  const formattedPeriodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', {
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
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isCritical
              ? 'bg-destructive/10 text-destructive /40'
              : isWarning
                ? 'bg-warning/10 text-warning /40'
                : 'bg-primary/10 text-primary',
          )}
        >
          {isCritical || isWarning ? (
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          ) : (
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium',
              isCritical ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground',
            )}
          >
            {creditsRemaining} of {creditsTotal} credits remaining
            {formattedPeriodEnd && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                — {messages.renewsOn.replace('{date}', formattedPeriodEnd)}
              </span>
            )}
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isCritical ? 'bg-destructive/50' : isWarning ? 'bg-warning/50' : 'bg-primary',
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
    </section>
  );
}

// ---------------------------------------------------------------------------
// Status alert (canceling / past_due)
// ---------------------------------------------------------------------------

export function StatusAlert({
  subscription,
  messages,
}: {
  subscription: SubscriptionData;
  messages: BillingMessages;
}) {
  const { subscriptionStatus, currentPeriodEnd } = subscription;

  if (subscriptionStatus !== 'canceling' && subscriptionStatus !== 'past_due') return null;

  const formattedDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const isCanceling = subscriptionStatus === 'canceling';

  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex items-start gap-3',
        isCanceling
          ? 'border-warning/40 bg-warning/10 /50 /20'
          : 'border-destructive/40 bg-destructive/10 /50 /20',
      )}
      role="alert"
    >
      <AlertTriangle
        className={cn('h-4 w-4 shrink-0 mt-0.5', isCanceling ? 'text-warning' : 'text-destructive')}
        aria-hidden="true"
      />
      <p className={cn('text-sm', isCanceling ? 'text-warning' : 'text-destructive')}>
        {isCanceling
          ? messages.statusCancelingMessage.replace('{date}', formattedDate)
          : messages.statusPastDueMessage}
      </p>
    </div>
  );
}
