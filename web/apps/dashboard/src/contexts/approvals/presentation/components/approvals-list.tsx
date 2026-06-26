'use client';

import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { Approval, ApprovalStatus } from '@/contexts/approvals/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | ApprovalStatus;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

function getMinutesRemaining(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

function formatCreatedAt(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const t = useTranslations('dashboard.approvals.status');

  const styles: Record<ApprovalStatus, string> = {
    pending: 'bg-warning/10 text-warning /30',
    approved: 'bg-success/10 text-success /30',
    rejected: 'bg-destructive/10 text-destructive /30',
    expired: 'bg-muted text-muted-foreground ',
  };

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[status],
      ].join(' ')}
    >
      {t(status)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Approval card
// ---------------------------------------------------------------------------

interface ApprovalCardProps {
  approval: Approval;
  onRespond: (approvalId: string, action: string) => Promise<void>;
  responding: string | null;
}

function ApprovalCard({ approval, onRespond, responding }: ApprovalCardProps) {
  const t = useTranslations('dashboard.approvals');
  const expired = isExpired(approval.expiresAt);
  const isPending = approval.status === 'pending' && !expired;
  const minutesRemaining = getMinutesRemaining(approval.expiresAt);
  const isResponding = responding === approval.approvalId;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      {/* Header: title + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">{approval.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2">{approval.description}</p>
        </div>
        <StatusBadge
          status={expired && approval.status === 'pending' ? 'expired' : approval.status}
        />
      </div>

      {/* Links: incident + remediation */}
      <div className="flex flex-wrap gap-3">
        {approval.incidentId && (
          <Link
            href={`/dashboard/incidents/${approval.incidentId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <span className="font-medium">{t('card.incident')}:</span>
            <span>{approval.incidentId}</span>
          </Link>
        )}
        {approval.remediationId && (
          <Link
            href={`/dashboard/remediations/${approval.remediationId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <span className="font-medium">{t('card.remediation')}:</span>
            <span>{approval.remediationId}</span>
          </Link>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {/* Timeout / expiry */}
        <div className="flex items-center gap-1">
          <span className="font-medium">{t('card.timeout')}:</span>
          <span>{approval.timeoutMinutes}min</span>
        </div>

        {/* Expiry status */}
        {approval.status === 'pending' && (
          <div
            className={[
              'flex items-center gap-1',
              expired ? 'text-destructive' : minutesRemaining <= 5 ? 'text-warning' : '',
            ].join(' ')}
          >
            {expired ? (
              <span>{t('card.expired')}</span>
            ) : (
              <>
                <span className="font-medium">{t('card.expiresIn')}:</span>
                <span>{minutesRemaining}min</span>
              </>
            )}
          </div>
        )}

        {/* Responded by */}
        {approval.respondedBy && (
          <div className="flex items-center gap-1">
            <span className="font-medium">{t('card.respondedBy')}:</span>
            <span>{approval.respondedBy}</span>
          </div>
        )}

        {/* Selected action */}
        {approval.selectedAction && (
          <div className="flex items-center gap-1">
            <span className="font-medium">{t('card.selectedAction')}:</span>
            <span className="capitalize">{approval.selectedAction.replace(/_/g, ' ')}</span>
          </div>
        )}

        {/* Created at */}
        <div className="flex items-center gap-1 ml-auto">
          <span>{formatCreatedAt(approval.createdAt)}</span>
        </div>
      </div>

      {/* Action buttons for pending approvals */}
      {isPending && approval.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
          {approval.actions.map((action) => {
            const isApprove = action === 'approve';
            const isReject = action === 'reject';

            let buttonClass =
              'inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

            if (isApprove) {
              buttonClass +=
                'bg-success/80 text-white hover:bg-success/80 dark:hover:bg-success/80';
            } else if (isReject) {
              buttonClass +=
                'bg-destructive/80 text-white hover:bg-destructive/80 dark:hover:bg-destructive/80';
            } else {
              buttonClass += ' border border-border bg-background text-foreground hover:bg-accent';
            }

            let label: string;
            if (isApprove) {
              label = t('actions.approve');
            } else if (isReject) {
              label = t('actions.reject');
            } else {
              label = action.replace(/_/g, ' ');
            }

            return (
              <button
                key={action}
                type="button"
                disabled={!!responding}
                onClick={() => onRespond(approval.approvalId, action)}
                className={buttonClass}
              >
                {isResponding ? t('actions.responding') : label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ApprovalSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-full" />
        </div>
        <div className="h-5 bg-muted rounded-full w-16 shrink-0" />
      </div>
      <div className="flex gap-3">
        <div className="h-3 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-24" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 bg-muted rounded w-16" />
        <div className="h-3 bg-muted rounded w-20" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: StatusFilter[] = ['all', 'pending', 'approved', 'rejected', 'expired'];

interface FilterTabsProps {
  active: StatusFilter;
  onChange: (f: StatusFilter) => void;
}

function FilterTabs({ active, onChange }: FilterTabsProps) {
  const t = useTranslations('dashboard.approvals.filters');
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {FILTER_OPTIONS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={[
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            active === f
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {t(f)}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApprovalsList() {
  const t = useTranslations('dashboard.approvals');
  const { addToast } = useToast();
  const { isSignedIn } = useAuth();

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [responding, setResponding] = useState<string | null>(null);

  const fetchApprovals = useCallback(
    async (status?: string) => {
      setLoading(true);
      try {
        const url =
          status && status !== 'all' ? `/api/approvals?status=${status}` : '/api/approvals';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setApprovals(data.approvals ?? []);
      } catch {
        addToast('Failed to load approvals', 'error');
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    fetchApprovals(filter);
  }, [filter, fetchApprovals]);

  async function handleRespond(approvalId: string, action: string) {
    if (!isSignedIn) return;
    setResponding(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to respond');
      addToast(
        `Approval ${action === 'approve' ? 'approved' : action.replace(/_/g, ' ')} successfully`,
        'success',
      );
      await fetchApprovals(filter);
    } catch {
      addToast('Failed to respond to approval', 'error');
    } finally {
      setResponding(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <FilterTabs active={filter} onChange={setFilter} />

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no identity
            <ApprovalSkeleton key={i} />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm font-medium text-foreground">{t('empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{t('emptyDescription')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.approvalId}
              approval={approval}
              onRespond={handleRespond}
              responding={responding}
            />
          ))}
        </div>
      )}
    </div>
  );
}
