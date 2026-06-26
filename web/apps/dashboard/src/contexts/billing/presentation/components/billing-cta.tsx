'use client';

import type { TenantPlan } from '@causeflow/shared/constants';
import { SITE } from '@causeflow/shared/constants';
import { cn } from '@causeflow/ui/lib';
import { ExternalLink, Loader2 } from 'lucide-react';
import type { BillingMessages } from './billing-types';

// ---------------------------------------------------------------------------
// Inline toast
// ---------------------------------------------------------------------------

export function InlineToast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: 'error' | 'success';
  onDismiss: () => void;
}) {
  const styles =
    type === 'error'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-success/40 bg-success/10 text-success';

  return (
    <output
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium',
        styles,
      )}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </output>
  );
}

// ---------------------------------------------------------------------------
// Manage subscription button
// ---------------------------------------------------------------------------

export function ManageSubscriptionButton({
  loadingPlanId,
  messages,
  onPortal,
}: {
  loadingPlanId: TenantPlan | 'portal' | null;
  messages: BillingMessages;
  onPortal: () => void;
}) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onPortal}
        disabled={loadingPlanId === 'portal'}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground',
          'hover:bg-accent hover:text-foreground transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {loadingPlanId === 'portal' ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        )}
        {loadingPlanId === 'portal' ? messages.loading : messages.manageSubscription}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export function BillingFooter() {
  return (
    <p className="text-xs text-muted-foreground text-center">
      Questions about billing? Contact us at{' '}
      <a
        href={`mailto:${SITE.email}`}
        className="underline hover:text-foreground transition-colors"
      >
        {SITE.email}
      </a>
    </p>
  );
}
