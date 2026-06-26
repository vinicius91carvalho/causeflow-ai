'use client';

import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface RemediationsEmptyStateProps {
  state: 'pending' | 'completed-empty' | 'error';
  /** Optional inline copy when state is `completed-empty`. */
  rootCause?: string;
  /** Provided only on the `error` state to enable the Retry button. */
  onRetry?: () => void;
}

/**
 * The terminal-state empty UI for the Remediations section. Replaces the
 * lying "no remediations proposed yet" copy with three explicit states:
 *
 *  - `pending`         — investigation still running, remediations may follow
 *  - `completed-empty` — investigation finished, no remediations needed
 *  - `error`           — fetch failed; surfaces a Retry button
 *
 * The `loading` skeleton stays in the parent so this component is purely
 * about post-fetch terminal states.
 */
export function RemediationsEmptyState({ state, rootCause, onRetry }: RemediationsEmptyStateProps) {
  const t = useTranslations('dashboard.incidents.detail.remediations');

  if (state === 'pending') {
    return (
      <div
        className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary"
        data-testid="remediations-empty-state"
        data-state="pending"
      >
        <Clock className="mt-0.5 h-4 w-4 animate-pulse" aria-hidden="true" />
        <span>{t('investigationPending')}</span>
      </div>
    );
  }

  if (state === 'completed-empty') {
    const message = rootCause ? t('completedEmptyWithCause', { rootCause }) : t('completedEmpty');
    return (
      <div
        className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-sm text-success"
        data-testid="remediations-empty-state"
        data-state="completed-empty"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <span>{message}</span>
      </div>
    );
  }

  // state === 'error'
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning"
      data-testid="remediations-empty-state"
      data-state="error"
    >
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <span>{t('errorState')}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto inline-flex items-center rounded-md border border-warning/60 bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/15 transition-colors dark:hover:bg-warning/80"
        >
          {t('retry')}
        </button>
      )}
    </div>
  );
}
