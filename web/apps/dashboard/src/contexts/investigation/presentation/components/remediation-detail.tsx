'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type {
  PullRequestStatus,
  Remediation,
  RemediationStatus,
  RemediationStepStatus,
  RiskLevel,
} from '@/contexts/investigation/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { Link } from '@/i18n/navigation';
import { RemediationStatusBadge } from './remediation-status-badge';

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const stepStatusClasses: Record<RemediationStepStatus, string> = {
  pending:
    'inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
  running:
    'inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
  completed:
    'inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success',
  failed:
    'inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive',
  skipped:
    'inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
};

const riskLevelClasses: Record<RiskLevel, string> = {
  low: 'inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success',
  medium:
    'inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning',
  high: 'inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive',
};

const riskLevelLabels: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

const prStatusClasses: Record<PullRequestStatus, string> = {
  open: 'inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning',
  merged:
    'inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
  closed:
    'inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RemediationDetailProps {
  initialRemediation: Remediation;
}

const POLLING_STATUS = new Set<RemediationStatus>(['executing']);

export function RemediationDetail({ initialRemediation }: RemediationDetailProps) {
  const t = useTranslations('dashboard.remediations.detail');
  const tStatus = useTranslations('dashboard.remediations.status');
  const tStepStatus = useTranslations('dashboard.remediations.detail.stepStatus');
  const tPrStatus = useTranslations('dashboard.remediations.detail.prStatus');
  const { addToast } = useToast();

  const [remediation, setRemediation] = useState<Remediation>(initialRemediation);
  const [isActing, setIsActing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRemediation = useCallback(async () => {
    try {
      const res = await fetch(`/api/remediations/${remediation.remediationId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { remediation: Remediation };
      const updated = data.remediation;

      setRemediation((prev) => {
        if (prev.status === 'executing' && updated.status === 'completed') {
          addToast('Remediation completed successfully!', 'success');
        } else if (prev.status === 'executing' && updated.status === 'failed') {
          addToast('Remediation failed.', 'error');
        }
        return updated;
      });
    } catch {
      // Silently ignore polling errors
    }
  }, [remediation.remediationId, addToast]);

  // Poll every 3s when executing
  useEffect(() => {
    if (!POLLING_STATUS.has(remediation.status)) return;
    const intervalId = setInterval(fetchRemediation, 3000);
    return () => clearInterval(intervalId);
  }, [remediation.status, fetchRemediation]);

  const performAction = useCallback(
    async (action: 'approve' | 'reject' | 'execute', reason?: string) => {
      setIsActing(true);
      try {
        const res = await fetch(`/api/remediations/${remediation.remediationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          addToast(err.error ?? `Failed to ${action} remediation`, 'error');
          return;
        }

        const data = (await res.json()) as { remediation: Remediation };
        setRemediation(data.remediation);

        const messages = {
          approve: 'Remediation approved.',
          reject: 'Remediation rejected.',
          execute: 'Remediation execution started.',
        } as const;
        addToast(messages[action], 'success');
        setShowRejectModal(false);
        setRejectReason('');
      } catch {
        addToast(`Failed to ${action} remediation. Please try again.`, 'error');
      } finally {
        setIsActing(false);
      }
    },
    [remediation.remediationId, addToast],
  );

  const isExecuting = remediation.status === 'executing';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/remediations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← {t('back')}
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <RemediationStatusBadge status={remediation.status} label={tStatus(remediation.status)} />
          <Link
            href={`/dashboard/incidents/${remediation.incidentId}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('incidentLink')}: {remediation.incidentId}
          </Link>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {remediation.description}
        </h2>

        {/* Polling indicator */}
        {isExecuting && (
          <output
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Remediation is executing. Updating automatically...
          </output>
        )}
      </div>

      {/* Action bar */}
      {(remediation.status === 'proposed' || remediation.status === 'approved') && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          {remediation.status === 'proposed' && (
            <>
              <button
                type="button"
                onClick={() => performAction('approve')}
                disabled={isActing}
                className="inline-flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-sm font-medium text-success hover:bg-success/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed /50 dark:hover:bg-success/80"
              >
                {isActing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
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
                )}
                {t('approve')}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={isActing}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed /50 dark:hover:bg-destructive/80"
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
            </>
          )}
          {remediation.status === 'approved' && (
            <button
              type="button"
              onClick={() => performAction('execute')}
              disabled={isActing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isActing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {t('execute')}
            </button>
          )}
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Reject remediation"
        >
          {/* Backdrop close button */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-default"
            aria-label="Close dialog"
            onClick={() => setShowRejectModal(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              {t('reject')} Remediation
            </h3>
            <label
              htmlFor="reject-reason"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('rejectionReason')} (optional)
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this remediation is being rejected..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="mt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performAction('reject', rejectReason || undefined)}
                disabled={isActing}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive/80 px-4 py-2 text-sm font-medium text-white hover:bg-destructive/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isActing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {t('reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Root Cause */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('rootCause')}
        </h3>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {remediation.rootCause}
        </p>
      </section>

      {/* Steps */}
      {remediation.steps && remediation.steps.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('steps')}
          </h3>
          <ol className="space-y-4">
            {remediation.steps.map((step) => (
              <li key={step.stepIndex} className="flex gap-4">
                {/* Step number */}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
                  {step.stepIndex + 1}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="flex-1 text-sm font-medium text-foreground leading-snug">
                      {step.label ?? step.action}
                    </p>
                    {step.riskLevel && (
                      <span className={riskLevelClasses[step.riskLevel]}>
                        {riskLevelLabels[step.riskLevel]}
                      </span>
                    )}
                    <span
                      className={
                        step.automated !== false
                          ? 'inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'
                          : 'inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                      }
                    >
                      {step.automated !== false ? 'Auto' : 'Manual'}
                    </span>
                    <span className={stepStatusClasses[step.status]}>
                      {step.status === 'running' && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-pulse"
                          aria-hidden="true"
                        />
                      )}
                      {tStepStatus(step.status)}
                    </span>
                  </div>

                  {step.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  )}

                  {step.output && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 font-mono leading-relaxed">
                      {step.output}
                    </p>
                  )}

                  {(step.startedAt || step.completedAt) && (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {step.startedAt && <span>Started: {formatDate(step.startedAt)}</span>}
                      {step.completedAt && <span>Completed: {formatDate(step.completedAt)}</span>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Pull Requests */}
      {remediation.pullRequests && remediation.pullRequests.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('pullRequests')}
          </h3>
          <ul className="space-y-3">
            {remediation.pullRequests.map((pr) => (
              <li
                key={`${pr.repoFullName}-${pr.prNumber}`}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{pr.repoFullName}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <a
                      href={pr.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline"
                    >
                      #{pr.prNumber}
                    </a>
                    <span>·</span>
                    <span className="font-mono">{pr.branch}</span>
                  </div>
                </div>
                <span className={prStatusClasses[pr.status]}>{tPrStatus(pr.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Metadata */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Metadata
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <dt className="text-muted-foreground shrink-0">{t('proposedBy')}:</dt>
            <dd className="text-foreground">{remediation.proposedBy}</dd>
          </div>
          {remediation.approvedBy && (
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground shrink-0">{t('approvedBy')}:</dt>
              <dd className="text-foreground">{remediation.approvedBy}</dd>
            </div>
          )}
          {remediation.rejectedBy && (
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground shrink-0">{t('rejectedBy')}:</dt>
              <dd className="text-foreground">{remediation.rejectedBy}</dd>
            </div>
          )}
          {remediation.rejectionReason && (
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground shrink-0">{t('rejectionReason')}:</dt>
              <dd className="text-foreground">{remediation.rejectionReason}</dd>
            </div>
          )}
          <div className="flex items-start gap-2">
            <dt className="text-muted-foreground shrink-0">Created:</dt>
            <dd className="text-foreground">{formatDate(remediation.createdAt)}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="text-muted-foreground shrink-0">Updated:</dt>
            <dd className="text-foreground">{formatDate(remediation.updatedAt)}</dd>
          </div>
          {remediation.completedAt && (
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground shrink-0">Completed:</dt>
              <dd className="text-foreground">{formatDate(remediation.completedAt)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
