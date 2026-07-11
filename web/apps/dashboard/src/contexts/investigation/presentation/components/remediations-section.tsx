'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type {
  IncidentStatus,
  Remediation,
  RemediationStatus,
} from '@/contexts/investigation/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { RemediationsEmptyState } from './incident-detail/remediations-empty-state';
import { RemediationStatusBadge } from './remediation-status-badge';

const REMEDIATION_STATUS_KEYS: Record<RemediationStatus, string> = {
  proposed: 'statusProposed',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  executing: 'statusExecuting',
  completed: 'statusCompleted',
  failed: 'statusFailed',
};

// ---------------------------------------------------------------------------
// Reject dialog (inline)
// ---------------------------------------------------------------------------

interface RejectDialogProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function RejectDialog({ onConfirm, onCancel, isLoading }: RejectDialogProps) {
  const t = useTranslations('dashboard.incidents.detail.remediations');
  const [reason, setReason] = useState('');

  return (
    <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 /40">
      <label htmlFor="reject-reason" className="mb-1 block text-xs font-medium text-foreground">
        {t('reason')}
      </label>
      <textarea
        id="reject-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        placeholder="Optional reason for rejection..."
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Rejecting...' : t('reject')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single remediation card
// ---------------------------------------------------------------------------

interface RemediationCardProps {
  remediation: Remediation;
  index: number;
  onUpdate: (updated: Remediation) => void;
}

function RemediationCard({ remediation, index, onUpdate }: RemediationCardProps) {
  const t = useTranslations('dashboard.incidents.detail.remediations');
  const { addToast } = useToast();
  const [loadingAction, setLoadingAction] = useState<'approve' | 'reject' | 'execute' | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const performAction = useCallback(
    async (action: 'approve' | 'reject' | 'execute', reason?: string) => {
      setLoadingAction(action);
      try {
        const body: { action: string; reason?: string } = { action };
        if (reason !== undefined) body.reason = reason;

        const res = await fetch(`/api/remediations/${remediation.remediationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          addToast(err.error ?? t('actionFailed', { action }), 'error');
          return;
        }

        const data = (await res.json()) as { remediation: Remediation };
        onUpdate(data.remediation);

        const ACTION_SUCCESS_KEYS = {
          approve: 'actionApproved',
          reject: 'actionRejected',
          execute: 'actionExecuting',
        } as const;
        addToast(t(ACTION_SUCCESS_KEYS[action]), 'success');
        setShowRejectDialog(false);
      } catch {
        addToast(t('actionFailedRetry', { action }), 'error');
      } finally {
        setLoadingAction(null);
      }
    },
    [remediation.remediationId, addToast, onUpdate, t],
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          #{index + 1}
        </span>
        <RemediationStatusBadge
          status={remediation.status as RemediationStatus}
          label={t(REMEDIATION_STATUS_KEYS[remediation.status as RemediationStatus])}
        />
      </div>

      {/* Steps — rich rendering with label, description, risk level */}
      {remediation.steps && remediation.steps.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('recommendedActions')}
          </p>
          <ul className="space-y-1.5">
            {remediation.steps.map((step) => {
              const label =
                step.label ??
                step.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <li
                  key={step.stepIndex}
                  className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
                >
                  <span className="mt-0.5 shrink-0 text-xs font-semibold text-muted-foreground">
                    {step.stepIndex + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{label}</span>
                      {step.riskLevel && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            step.riskLevel === 'high'
                              ? 'bg-destructive/10 text-destructive /50 '
                              : step.riskLevel === 'medium'
                                ? 'bg-warning/10 text-warning /50 '
                                : 'bg-success/10 text-success /50 '
                          }`}
                        >
                          {step.riskLevel}
                        </span>
                      )}
                      {step.automated !== undefined && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            step.automated
                              ? 'bg-primary/10 text-primary /50 '
                              : 'bg-muted text-muted-foreground '
                          }`}
                        >
                          {step.automated ? 'auto' : 'manual'}
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : remediation.description ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('recommendedActions')}
          </p>
          <ul className="space-y-1">
            {remediation.description
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0 && !line.startsWith('Remediation for:'))
              .map((action) => {
                const clean = action.replace(/^[-•]\s*/, '');
                const label = clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <li key={clean} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-0.5 shrink-0 text-success">-</span>
                    <span className="font-medium">{label}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      {/* Approved / rejected by */}
      {remediation.approvedBy && (
        <p className="text-xs text-muted-foreground">
          {t('approvedBy', { user: remediation.approvedBy })}
        </p>
      )}
      {remediation.rejectedBy && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {t('rejectedBy', { user: remediation.rejectedBy })}
          </p>
          {remediation.rejectionReason && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{t('reason')}:</span> {remediation.rejectionReason}
            </p>
          )}
        </div>
      )}

      {/* Actions for proposed — matches the CauseFlow Confirm/Reject RCA style
          used in <IncidentFeedback>: outlined + tinted, never solid filled. */}
      {remediation.status === 'proposed' && (
        <div className="space-y-2">
          {!showRejectDialog && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => performAction('approve')}
                disabled={loadingAction === 'approve' || loadingAction === 'reject'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed /50 dark:hover:bg-success/80"
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
                {loadingAction === 'approve' ? t('approving') : t('approve')}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectDialog(true)}
                disabled={loadingAction === 'approve' || loadingAction === 'reject'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60 /50 dark:hover:bg-destructive/80"
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
          )}
          {showRejectDialog && (
            <RejectDialog
              onConfirm={(reason) => performAction('reject', reason)}
              onCancel={() => setShowRejectDialog(false)}
              isLoading={loadingAction === 'reject'}
            />
          )}
        </div>
      )}

      {/* Execute button for approved */}
      {remediation.status === 'approved' && (
        <button
          type="button"
          onClick={() => performAction('execute')}
          disabled={loadingAction === 'execute'}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loadingAction === 'execute' ? t('executing') : t('execute')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Remediations section
// ---------------------------------------------------------------------------

interface RemediationsSectionProps {
  incidentId: string;
  autoApprove?: boolean;
  /**
   * When present, the four-state empty UI distinguishes "investigation still
   * running" from "completed with zero remediations". When omitted, the
   * section defaults to the safer pending state.
   */
  incidentStatus?: IncidentStatus;
  /** Optional root cause for the completed-empty inline copy. */
  rootCause?: string;
  /** When true, the entire section is hidden if there are no remediations. */
  hideWhenEmpty?: boolean;
  /** Bump to re-fetch (e.g. on SSE `remediation.proposed`). */
  refreshKey?: number;
}

const LIVE_REMEDIATION_POLL_STATUSES: ReadonlySet<IncidentStatus> = new Set([
  'open',
  'triaging',
  'investigating',
  'awaiting_approval',
]);

export function RemediationsSection({
  incidentId,
  autoApprove,
  incidentStatus,
  rootCause: _rootCause,
  hideWhenEmpty,
  refreshKey = 0,
}: RemediationsSectionProps) {
  const t = useTranslations('dashboard.incidents.detail.remediations');
  const [remediations, setRemediations] = useState<Remediation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchRemediations = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/remediations?incidentId=${encodeURIComponent(incidentId)}`);
      if (!res.ok) {
        // Explicit error state so the section never gets stuck on the loading skeleton.
        setError('failed_load');
        setRemediations([]);
        return;
      }
      const data = (await res.json()) as { remediations?: Remediation[] };
      setRemediations(data.remediations ?? []);
    } catch {
      setError('failed_load');
      setRemediations([]);
    }
  }, [incidentId]);

  useEffect(() => {
    void fetchRemediations();
  }, [fetchRemediations, refreshKey]);

  // Documented polling fallback while Core investigation is live (AC-060).
  // 15s cadence avoids compounding Core RATE_LIMIT with SSE + detail polls.
  useEffect(() => {
    if (!incidentStatus || !LIVE_REMEDIATION_POLL_STATUSES.has(incidentStatus)) return;
    const id = setInterval(() => {
      void fetchRemediations();
    }, 15_000);
    return () => clearInterval(id);
  }, [incidentStatus, fetchRemediations]);

  const handleUpdate = useCallback((updated: Remediation) => {
    setRemediations((prev) =>
      prev ? prev.map((r) => (r.remediationId === updated.remediationId ? updated : r)) : prev,
    );
  }, []);

  // Hide the entire section when there are no remediations and caller opted in
  if (hideWhenEmpty && remediations !== null && remediations.length === 0 && !error) {
    return null;
  }

  return (
    <section
      data-testid="incident-remediations"
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 text-left"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('title')}
        </h3>
        {remediations !== null && remediations.length > 0 && (
          <span
            data-testid="incident-remediations-count"
            className="text-xs font-medium text-muted-foreground"
          >
            ({remediations.length})
          </span>
        )}
        {autoApprove && (
          <span className="inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            {t('autoApproveEnabled')}
          </span>
        )}
        <span className="ml-auto">
          <ChevronRight
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 ease-in-out${isOpen ? ' rotate-90' : ''}`}
          />
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="mt-3">
            {error ? (
              <RemediationsEmptyState
                state="error"
                onRetry={() => {
                  void fetchRemediations();
                }}
              />
            ) : remediations === null ? (
              <div className="space-y-2" aria-busy="true" data-testid="remediations-skeleton">
                <div className="h-20 w-full animate-pulse rounded bg-muted" />
                <div className="h-20 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <div className="space-y-3">
                {remediations.map((rem, idx) => (
                  <RemediationCard
                    key={rem.remediationId}
                    remediation={rem}
                    index={idx}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
