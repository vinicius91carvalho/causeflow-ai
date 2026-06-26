'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRelativeTime } from '@/contexts/shared/lib/format-date';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import type { FeedbackItem, FeedbackType } from '@/lib/api/core-api-types';
import { FeedbackEmptyState } from './incident-detail/feedback-empty-state';

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

const typeBadgeClasses: Record<FeedbackType, string> = {
  investigation_accurate: 'border-success/40 bg-success/10 text-success',
  investigation_inaccurate: 'border-destructive/40 bg-destructive/10 text-destructive',
  investigation_partial: 'border-primary/40 bg-primary/10 text-primary',
};

function FeedbackTypeBadge({ type, label }: { type: FeedbackType; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${typeBadgeClasses[type]}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Feedback history item
// ---------------------------------------------------------------------------

function FeedbackHistoryItem({ item, typeLabel }: { item: FeedbackItem; typeLabel: string }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FeedbackTypeBadge type={item.type} label={typeLabel} />
        <span className="text-xs text-muted-foreground font-medium">{item.actor}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatRelativeTime(item.createdAt, { compact: true })}
        </span>
      </div>
      {item.comment && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {item.comment}
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Action form
// ---------------------------------------------------------------------------

interface ActionFormProps {
  type: FeedbackType;
  label: string;
  incidentId: string;
  onSuccess: (item: FeedbackItem) => void;
  onCancel: () => void;
  commentPlaceholder: string;
  commentLabel: string;
  submitLabel: string;
}

function ActionForm({
  type,
  label,
  incidentId,
  onSuccess,
  onCancel,
  commentPlaceholder,
  commentLabel,
  submitLabel,
}: ActionFormProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when form opens
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, freeText: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setSubmitError(err.error ?? 'Failed to submit feedback');
        return;
      }
      const item = (await res.json()) as FeedbackItem;
      onSuccess(item);
      setComment('');
    } catch {
      setSubmitError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3"
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div>
        <label htmlFor={`feedback-comment-${type}`} className="sr-only">
          {commentLabel}
        </label>
        <textarea
          ref={textareaRef}
          id={`feedback-comment-${type}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={commentPlaceholder}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
      </div>
      {submitError && (
        <p role="alert" className="text-xs text-destructive">
          {submitError}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface IncidentFeedbackProps {
  incidentId: string;
}

export function IncidentFeedback({ incidentId }: IncidentFeedbackProps) {
  const t = useTranslations('dashboard.incidents.detail.feedback');
  const { addToast } = useToast();

  const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<FeedbackType | null>(null);

  const fetchFeedback = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/feedback`);
      if (!res.ok) {
        // Explicit error state so the section never gets stuck on the loading skeleton.
        setError('failed_load');
        setFeedback([]);
        return;
      }
      const data = (await res.json()) as { feedback: FeedbackItem[] };
      setFeedback(data.feedback ?? []);
    } catch {
      setError('failed_load');
      setFeedback([]);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const typeLabels: Record<FeedbackType, string> = {
    investigation_accurate: t('confirmed'),
    investigation_inaccurate: t('rejected'),
    investigation_partial: t('context'),
  };

  async function handleSuccess(item: FeedbackItem) {
    setFeedback((prev) => (prev ? [item, ...prev] : [item]));
    setActiveAction(null);
    addToast(t('success'), 'success');
  }

  function handleActionClick(type: FeedbackType) {
    setActiveAction((prev) => (prev === type ? null : type));
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('title')}
      </h3>

      {/* Action buttons — hidden once any feedback exists */}
      {feedback !== null && feedback.length === 0 && !error && (
        <>
          <div className="flex flex-wrap gap-2">
            {/* Accurate */}
            <button
              type="button"
              onClick={() => handleActionClick('investigation_accurate')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeAction === 'investigation_accurate'
                  ? 'border-success/60 bg-success/10 text-success '
                  : 'border-success/40 bg-success/10 text-success hover:bg-success/10 /50 dark:hover:bg-success/80'
              }`}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {t('confirm')}
            </button>

            {/* Inaccurate */}
            <button
              type="button"
              onClick={() => handleActionClick('investigation_inaccurate')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeAction === 'investigation_inaccurate'
                  ? 'border-destructive/60 bg-destructive/10 text-destructive '
                  : 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/10 /50 dark:hover:bg-destructive/80'
              }`}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('reject')}
            </button>
          </div>

          {/* Active action form */}
          {activeAction && (
            <ActionForm
              type={activeAction}
              label={typeLabels[activeAction]}
              incidentId={incidentId}
              onSuccess={handleSuccess}
              onCancel={() => setActiveAction(null)}
              commentPlaceholder={t('commentPlaceholder')}
              commentLabel={t('comment')}
              submitLabel={t('submit')}
            />
          )}
        </>
      )}

      {/* Feedback history */}
      <div className="mt-5">
        {error ? (
          <FeedbackEmptyState
            state="error"
            onRetry={() => {
              void fetchFeedback();
            }}
          />
        ) : feedback === null ? (
          <div
            aria-busy="true"
            className="h-6 w-2/3 animate-pulse rounded bg-muted"
            data-testid="feedback-skeleton"
          />
        ) : feedback.length === 0 ? (
          <FeedbackEmptyState state="empty" />
        ) : (
          <ul className="space-y-2">
            {feedback.map((item) => (
              <FeedbackHistoryItem key={item.id} item={item} typeLabel={typeLabels[item.type]} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
