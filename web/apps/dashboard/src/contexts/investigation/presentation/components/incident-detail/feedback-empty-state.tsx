'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FeedbackEmptyStateProps {
  state: 'empty' | 'error';
  /** Provided only on the `error` state to enable the Retry button. */
  onRetry?: () => void;
}

/**
 * Empty / error states for the Feedback section. The `loading` skeleton
 * stays in the parent `<IncidentFeedback>` component.
 */
export function FeedbackEmptyState({ state, onRetry }: FeedbackEmptyStateProps) {
  const t = useTranslations('dashboard.incidents.detail.feedback');

  if (state === 'empty') {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="feedback-empty-state"
        data-state="empty"
      >
        {t('empty')}
      </p>
    );
  }

  // state === 'error' — falls through here.
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning"
      data-testid="feedback-empty-state"
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
