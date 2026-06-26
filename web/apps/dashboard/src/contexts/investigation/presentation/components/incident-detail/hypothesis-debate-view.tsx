'use client';

import {
  Beaker,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Scale,
  Sprout,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type {
  Hypothesis,
  HypothesisEvidenceRef,
  InvestigationModeName,
} from '@/contexts/investigation/domain/types';

interface HypothesisDebateViewProps {
  incidentId: string;
  /** When omitted, defaults to `orchestrator` and the component renders nothing. */
  mode?: InvestigationModeName;
  /**
   * Current incident status. Changes trigger a re-fetch — the parent owns
   * the WebSocket relay (see `InvestigationLiveFeed.onStatusChange`) and
   * refreshes the incident on relay events, which propagates here as a
   * new `status` value and causes hypothesis data to refresh reactively.
   * No internal polling: the WS pipeline is the source of truth.
   */
  status: string;
  /**
   * Optional opaque token the parent can bump whenever it wants to force
   * a hypothesis re-fetch without a status transition (e.g. when a
   * `judge_complete` progress event arrives mid-investigating). Safe to
   * omit — status-based refresh already covers the terminal transition.
   */
  refreshKey?: string | number;
}

/**
 * Renders a structured view of the investigation's hypotheses when the
 * incident ran under `hypothesis` or `debate` mode. The winner is shown
 * prominently; rejected hypotheses live in a collapsible accordion so
 * the audit trail is visible without dominating the page.
 *
 * Data refresh model: fetch on mount, then re-fetch whenever `status` or
 * `refreshKey` changes. Status transitions come from the shared WS relay
 * via the parent — no local polling.
 */
export function HypothesisDebateView({
  incidentId,
  mode,
  status,
  refreshKey,
}: HypothesisDebateViewProps) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  const [hypotheses, setHypotheses] = useState<Hypothesis[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHypotheses = useCallback(async () => {
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/hypotheses`);
      if (!res.ok) {
        setError('failed');
        return;
      }
      const data = (await res.json()) as { hypotheses: Hypothesis[] };
      setHypotheses(data.hypotheses ?? []);
      setError(null);
    } catch {
      setError('failed');
    }
  }, [incidentId]);

  // Fetch on mount and whenever the incident status or refresh token changes
  // — the WS relay pushes status changes via the parent's `handleWsStatusChange`,
  // which updates `incident.status`, which re-renders this prop, which triggers
  // a refetch. Fully reactive, no setInterval.
  useEffect(() => {
    void fetchHypotheses();
  }, [fetchHypotheses, status, refreshKey]);

  // Only render when the incident is actually using a hypothesis-based mode.
  if (!mode || mode === 'orchestrator') return null;

  if (error && hypotheses === null) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {t('errorLoading')}
      </section>
    );
  }

  if (hypotheses === null) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" aria-busy="true" />
      </section>
    );
  }

  if (hypotheses.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-primary/40 bg-primary/10/40 p-4 text-sm text-primary /20">
        <div className="flex items-center gap-2">
          <Sprout className="h-4 w-4" aria-hidden="true" />
          <span>{t('waitingForSeeker', { mode: t(`mode.${mode}`) })}</span>
        </div>
      </section>
    );
  }

  const winner = hypotheses.find((h) => h.status === 'confirmed');
  const pending = hypotheses.filter((h) => h.status === 'pending');
  const rejected = hypotheses.filter((h) => h.status === 'rejected');

  return (
    <section className="space-y-3">
      {winner && <WinnerCard hypothesis={winner} mode={mode} />}

      {pending.length > 0 && <PendingStack hypotheses={pending} />}

      {rejected.length > 0 && <RejectedStack hypotheses={rejected} />}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Winner
// ─────────────────────────────────────────────────────────────────────

function WinnerCard({ hypothesis, mode }: { hypothesis: Hypothesis; mode: InvestigationModeName }) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  return (
    <section
      aria-labelledby={`winner-${hypothesis.hypothesisId}`}
      className="rounded-xl border border-success/40 bg-success/10/60 p-5 shadow-sm /30"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-success/60 bg-success/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('winnerBadge')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground uppercase tracking-wide">
          <Scale className="h-3 w-3" aria-hidden="true" />
          {t(`mode.${mode}`)}
        </span>
        <ScoreBadge score={hypothesis.finalScore} />
      </div>

      <h3
        id={`winner-${hypothesis.hypothesisId}`}
        className="text-base font-semibold leading-snug text-foreground"
      >
        {hypothesis.statement}
      </h3>

      {hypothesis.rationale && (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hypothesis.rationale}</p>
      )}

      {hypothesis.informedBy && hypothesis.informedBy.length > 0 && (
        <InformedBy tags={hypothesis.informedBy} />
      )}

      <ConfidenceBar confidence={hypothesis.confidence} />

      <EvidenceLists hypothesis={hypothesis} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pending (still being evaluated) — render between winner and rejected
// ─────────────────────────────────────────────────────────────────────

function PendingStack({ hypotheses }: { hypotheses: Hypothesis[] }) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  return (
    <section
      aria-label={t('pendingTitle')}
      className="rounded-xl border border-primary/40 bg-primary/10/40 p-4 /20"
    >
      <h4 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Beaker className="h-3.5 w-3.5" aria-hidden="true" />
        {t('pendingTitle')} ({hypotheses.length})
      </h4>
      <ul className="space-y-2">
        {hypotheses.map((h) => (
          <li
            key={h.hypothesisId}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground">{h.statement}</p>
              <ScoreBadge score={h.finalScore} prior={h.confidence} />
            </div>
            {h.informedBy && h.informedBy.length > 0 && <InformedBy tags={h.informedBy} compact />}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rejected (audit trail, collapsed by default)
// ─────────────────────────────────────────────────────────────────────

function RejectedStack({ hypotheses }: { hypotheses: Hypothesis[] }) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {t('rejectedTitle')} ({hypotheses.length})
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {hypotheses.map((h) => (
            <li key={h.hypothesisId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-start gap-2 text-sm text-foreground">
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                    <span className="line-through decoration-muted-foreground/40">
                      {h.statement}
                    </span>
                  </p>
                  {h.rejectedReason && (
                    <p className="mt-1 pl-6 text-xs text-muted-foreground">
                      <span className="font-medium">{t('rejectedReasonLabel')}: </span>
                      {h.rejectedReason}
                    </p>
                  )}
                  {h.informedBy && h.informedBy.length > 0 && (
                    <div className="pl-6">
                      <InformedBy tags={h.informedBy} compact />
                    </div>
                  )}
                </div>
                <ScoreBadge score={h.finalScore} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────

function ScoreBadge({ score, prior }: { score?: number; prior?: number }) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  if (score === undefined) {
    if (prior === undefined) return null;
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {t('priorLabel')} {Math.round(prior * 100)}%
      </span>
    );
  }
  const tone =
    score >= 70
      ? 'border-success/60 bg-success/10 text-success'
      : score >= 40
        ? 'border-warning/60 bg-warning/10 text-warning'
        : 'border-destructive/60 bg-destructive/10 text-destructive';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
      title={t('scoreLabel', { score })}
    >
      {Math.round(score)}/100
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  const pct = Math.max(0, Math.min(1, confidence)) * 100;
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{t('confidence')}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('confidenceLabel', { pct: Math.round(pct) })}
      >
        <div
          className="h-full rounded-full bg-success/50 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InformedBy({ tags, compact = false }: { tags: string[]; compact?: boolean }) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? 'mt-1' : 'mt-2'}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t('informedBy')}:
      </span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function EvidenceLists({ hypothesis }: { hypothesis: Hypothesis }) {
  const t = useTranslations('dashboard.incidents.detail.hypotheses');
  const hasFor = hypothesis.evidenceFor.length > 0;
  const hasAgainst = hypothesis.evidenceAgainst.length > 0;
  if (!hasFor && !hasAgainst) return null;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {hasFor && (
        <EvidenceColumn
          title={t('evidenceFor')}
          icon={<TrendingUp className="h-3.5 w-3.5 text-success" />}
          items={hypothesis.evidenceFor}
          accent="for"
        />
      )}
      {hasAgainst && (
        <EvidenceColumn
          title={t('evidenceAgainst')}
          icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          items={hypothesis.evidenceAgainst}
          accent="against"
        />
      )}
    </div>
  );
}

function EvidenceColumn({
  title,
  icon,
  items,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  items: HypothesisEvidenceRef[];
  accent: 'for' | 'against';
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h4 className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title} ({items.length})
      </h4>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.evidenceId} className="flex items-start gap-2 text-xs">
            <WeightPill weight={item.weight} accent={accent} />
            <div className="min-w-0 flex-1">
              <p className="text-foreground leading-snug">{item.summary}</p>
              {item.toolName && (
                <p className="text-[10px] font-mono text-muted-foreground">{item.toolName}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeightPill({ weight, accent }: { weight: number; accent: 'for' | 'against' }) {
  const magnitude = Math.abs(weight);
  const intensity = magnitude >= 0.7 ? 'strong' : magnitude >= 0.4 ? 'medium' : 'weak';
  const toneMap = {
    for: {
      strong: 'border-success/60 bg-success/50/20 text-success /30',
      medium: 'border-success/60 bg-success/10 text-success /50',
      weak: 'border-success/40 bg-success/10 text-success /30',
    },
    against: {
      strong: 'border-destructive/60 bg-destructive/50/20 text-destructive /30',
      medium: 'border-destructive/60 bg-destructive/10 text-destructive /50',
      weak: 'border-destructive/40 bg-destructive/10 text-destructive /30',
    },
  } as const;
  const sign = accent === 'for' ? '+' : '−';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${toneMap[accent][intensity]}`}
      title={`weight ${weight.toFixed(2)}`}
    >
      {sign}
      {magnitude.toFixed(1)}
    </span>
  );
}
