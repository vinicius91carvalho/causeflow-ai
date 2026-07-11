'use client';

import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FileSearch,
  Hammer,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageCircle,
  PlayCircle,
  Search,
  Send,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Incident,
  IncidentSeverity,
  Remediation,
} from '@/contexts/investigation/domain/types';
import type { InvestigationDetail, InvestigationEvidence } from '@/lib/api/core-api-types';

type Translator = ReturnType<typeof useTranslations>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EvidenceReviewViewProps {
  incident: Incident;
  /**
   * Action bar (approve / rerun / abort buttons) rendered inside the approval
   * card at the top of the right rail.
   */
  approvalActionsSlot?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Static vocabulary
// ---------------------------------------------------------------------------

const SEVERITY_CLASSES: Record<IncidentSeverity, string> = {
  critical: 'border-destructive/30 bg-destructive/10 text-destructive',
  high: 'border-destructive/30 bg-destructive/10 text-destructive',
  medium: 'border-warning/30 bg-warning/10 text-warning',
  low: 'border-success/30 bg-success/10 text-success',
  info: 'border-border bg-muted text-muted-foreground',
};

// Human-readable labels for the evidenceType vocabulary returned by the backend.
const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  log_snippet: 'log_snippet',
  metric_snapshot: 'metric_snapshot',
  trace_span: 'trace_span',
  resource_state: 'resource_state',
  agent_reasoning: 'agent_reasoning',
  user_context: 'user_context',
  historical_context: 'historical_context',
};

const EVIDENCE_TYPE_CLASSES: Record<string, { dot: string; tag: string }> = {
  log_snippet: {
    dot: 'bg-warning',
    tag: 'bg-warning/10 text-warning',
  },
  metric_snapshot: {
    dot: 'bg-accent',
    tag: 'bg-accent/10 text-accent',
  },
  trace_span: {
    dot: 'bg-accent',
    tag: 'bg-accent/10 text-accent',
  },
  resource_state: {
    dot: 'bg-primary',
    tag: 'bg-primary/10 text-primary',
  },
  agent_reasoning: {
    dot: 'bg-success',
    tag: 'bg-success/10 text-success',
  },
  user_context: {
    dot: 'bg-muted-foreground',
    tag: 'bg-muted text-muted-foreground',
  },
  historical_context: {
    dot: 'bg-muted-foreground',
    tag: 'bg-muted text-muted-foreground',
  },
};

const DEFAULT_EVIDENCE_TYPE_CLASS = {
  dot: 'bg-muted-foreground',
  tag: 'bg-muted text-muted-foreground',
};

// Synthesis-style roles (final consolidation) vs investigative roles.
const SYNTHESIS_ROLES = new Set(['coordinator', 'synthesis']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const deltaMs = Math.max(0, end - start);
  const minutes = Math.floor(deltaMs / 60000);
  const seconds = Math.floor((deltaMs % 60000) / 1000);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function formatWindow(startIso: string, endIso: string) {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateFmt.format(start)} · ${timeFmt.format(start)} → ${timeFmt.format(end)}`;
  } catch {
    return '';
  }
}

function formatTimeOfDay(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function formatRelativeFromStart(startIso: string, iso: string) {
  const delta = new Date(iso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(delta) || delta < 0) return '';
  const m = Math.floor(delta / 60000);
  const s = Math.floor((delta % 60000) / 1000);
  return `+${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

function groupEvidenceByBucket(
  evidenceByAgent: Record<string, InvestigationEvidence[]>,
  t: Translator,
): Array<{
  key: 'synthesis' | 'investigation';
  label: string;
  sub: string;
  items: InvestigationEvidence[];
}> {
  const synthesis: InvestigationEvidence[] = [];
  const investigation: InvestigationEvidence[] = [];

  for (const [role, items] of Object.entries(evidenceByAgent)) {
    if (SYNTHESIS_ROLES.has(role)) {
      synthesis.push(...items);
    } else {
      investigation.push(...items);
    }
  }

  const byTime = (a: InvestigationEvidence, b: InvestigationEvidence) =>
    a.createdAt.localeCompare(b.createdAt);
  synthesis.sort(byTime);
  investigation.sort(byTime);

  const out: Array<{
    key: 'synthesis' | 'investigation';
    label: string;
    sub: string;
    items: InvestigationEvidence[];
  }> = [];
  if (investigation.length > 0) {
    out.push({
      key: 'investigation',
      label: t('groups.investigationLabel'),
      sub: t('groups.investigationSub'),
      items: investigation,
    });
  }
  if (synthesis.length > 0) {
    out.push({
      key: 'synthesis',
      label: t('groups.synthesisLabel'),
      sub: t('groups.synthesisSub'),
      items: synthesis,
    });
  }
  return out;
}

function deriveActionsFromRemediations(remediations: Remediation[]) {
  type FlatAction = {
    id: string;
    title: string;
    description?: string;
    automated: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    status: string;
    remediationId: string;
    stepIndex?: number;
  };
  const actions: FlatAction[] = [];
  for (const r of remediations) {
    if (r.steps && r.steps.length > 0) {
      for (const step of r.steps) {
        actions.push({
          id: `${r.remediationId}:${step.stepIndex}`,
          title: step.label || step.action,
          description: step.description,
          automated: step.automated ?? false,
          riskLevel: step.riskLevel ?? 'medium',
          status: step.status,
          remediationId: r.remediationId,
          stepIndex: step.stepIndex,
        });
      }
    } else {
      actions.push({
        id: r.remediationId,
        title: r.description || r.rootCause || r.remediationId,
        description: r.rootCause,
        automated: false,
        riskLevel: 'medium',
        status: r.status,
        remediationId: r.remediationId,
      });
    }
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvidenceReviewView({ incident, approvalActionsSlot }: EvidenceReviewViewProps) {
  const t = useTranslations('dashboard.incidents.detail.evidenceReview');
  const [detail, setDetail] = useState<InvestigationDetail | null>(null);
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isLoadingRemediations, setIsLoadingRemediations] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [detailRes, remRes] = await Promise.all([
          fetch(`/api/investigation/${incident.incidentId}/detail`),
          fetch(`/api/remediations?incidentId=${encodeURIComponent(incident.incidentId)}`),
        ]);
        if (!cancelled) {
          if (detailRes.ok) {
            const data = (await detailRes.json()) as InvestigationDetail;
            setDetail(data);
          }
          if (remRes.ok) {
            const data = (await remRes.json()) as { remediations: Remediation[] };
            setRemediations(data.remediations ?? []);
          }
        }
      } catch {
        if (!cancelled) setHasLoadError(true);
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false);
          setIsLoadingRemediations(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [incident.incidentId]);

  const allEvidences: InvestigationEvidence[] = useMemo(() => {
    if (!detail) return [];
    return Object.values(detail.evidenceByAgent).flat();
  }, [detail]);

  const evidenceTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of allEvidences) {
      counts[e.evidenceType] = (counts[e.evidenceType] ?? 0) + 1;
    }
    return counts;
  }, [allEvidences]);

  const uniqueToolCalls = useMemo(() => {
    const s = new Set<string>();
    for (const e of allEvidences) {
      if (e.toolCallId) s.add(e.toolCallId);
    }
    return s.size;
  }, [allEvidences]);

  const flatActions = useMemo(() => deriveActionsFromRemediations(remediations), [remediations]);

  const autoActionCount = flatActions.filter((a) => a.automated).length;
  const manualActionCount = flatActions.length - autoActionCount;

  const duration = useMemo(
    () => formatDuration(incident.createdAt, incident.updatedAt),
    [incident.createdAt, incident.updatedAt],
  );
  const windowLabel = useMemo(
    () => formatWindow(incident.createdAt, incident.updatedAt),
    [incident.createdAt, incident.updatedAt],
  );

  // Tab + filter + search state.
  const [activeTab, setActiveTab] = useState<'evidences' | 'actions' | 'discussion'>('evidences');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Follow-up chat state (REST fallback — works when no live WS worker is
  // attached, which is the common case post-investigation).
  type ChatMessage = { role: 'user' | 'assistant'; content: string; createdAt: string };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/investigation/${incident.incidentId}/chat`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { messages: ChatMessage[] };
          setChatMessages(data.messages ?? []);
        }
      } catch {
        /* silent — empty history is fine */
      } finally {
        if (!cancelled) setIsLoadingChat(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [incident.incidentId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll on new messages
  useEffect(() => {
    if (activeTab === 'discussion' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeTab, chatMessages.length]);

  const sendFollowupMessage = async () => {
    const message = chatDraft.trim();
    if (!message || isSendingMessage) return;
    setIsSendingMessage(true);
    setChatError(null);

    // Optimistic: append the user turn immediately.
    const optimistic: ChatMessage = {
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimistic]);
    setChatDraft('');

    try {
      const res = await fetch(`/api/investigation/${incident.incidentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      // Reload history so we pick up whatever the assistant returned.
      const hist = await fetch(`/api/investigation/${incident.incidentId}/chat`);
      if (hist.ok) {
        const data = (await hist.json()) as { messages: ChatMessage[] };
        setChatMessages(data.messages ?? []);
      }
    } catch {
      setChatError(t('chat.sendFailed'));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const filteredEvidenceByAgent = useMemo(() => {
    if (!detail) return {};
    const q = search.trim().toLowerCase();
    const out: Record<string, InvestigationEvidence[]> = {};
    for (const [role, items] of Object.entries(detail.evidenceByAgent)) {
      const kept = items.filter((e) => {
        if (typeFilter && e.evidenceType !== typeFilter) return false;
        if (!q) return true;
        return (
          (e.claim?.toLowerCase().includes(q) ?? false) ||
          (e.quote?.toLowerCase().includes(q) ?? false) ||
          (e.content?.toLowerCase().includes(q) ?? false) ||
          (e.toolCallId?.toLowerCase().includes(q) ?? false) ||
          (e.metadata?.toolName?.toLowerCase().includes(q) ?? false)
        );
      });
      if (kept.length > 0) out[role] = kept;
    }
    return out;
  }, [detail, typeFilter, search]);

  const awaitingApproval = incident.status === 'awaiting_approval';
  const severityClass = SEVERITY_CLASSES[incident.severity];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* =============================== MAIN COLUMN =============================== */}
      <section className="min-w-0 space-y-5">
        {/* Incident header */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {awaitingApproval && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-warning">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse"
                  aria-hidden="true"
                />
                {t('status.awaitingApproval')}
              </span>
            )}
            {incident.status === 'resolved' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-success">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {t('status.resolved')}
              </span>
            )}
            <span
              data-testid="incident-severity"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] ${severityClass}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {t(`severity.${incident.severity}`)}
            </span>
            <span className="font-mono text-[11.5px] text-muted-foreground">
              INC-{incident.incidentId.slice(0, 8)}
            </span>
            {incident.sourceProvider && (
              <>
                <span className="h-[3px] w-[3px] rounded-full bg-border" aria-hidden="true" />
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  {incident.sourceProvider}
                </span>
              </>
            )}
            {incident.sourceAlertId && (
              <>
                <span className="h-[3px] w-[3px] rounded-full bg-border" aria-hidden="true" />
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  {t('incidentRefLabel')}:{' '}
                  <span className="font-semibold text-foreground/80">{incident.sourceAlertId}</span>
                </span>
              </>
            )}
          </div>
          <h1 className="m-0 text-2xl font-bold leading-tight tracking-tight text-foreground">
            {incident.title}
          </h1>
          {incident.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{incident.description}</p>
          )}
        </header>

        {/* Investigation summary strip */}
        <SummaryStrip
          duration={duration}
          window={windowLabel}
          evidenceTotal={allEvidences.length}
          evidenceSynthesisCount={
            allEvidences.filter((e) => SYNTHESIS_ROLES.has(e.agentRole)).length
          }
          evidenceCollectionCount={
            allEvidences.filter((e) => !SYNTHESIS_ROLES.has(e.agentRole)).length
          }
          toolCalls={uniqueToolCalls}
          toolNames={Array.from(
            new Set(allEvidences.map((e) => e.metadata?.toolName).filter(Boolean) as string[]),
          ).slice(0, 2)}
          actionsTotal={flatActions.length}
          actionsAuto={autoActionCount}
          actionsManual={manualActionCount}
          loading={isLoadingDetail || isLoadingRemediations}
          t={t}
        />

        {/* Root cause hero */}
        {incident.rootCause?.trim() ? (
          <section
            data-testid="incident-root-cause"
            data-state="identified"
            className="relative rounded-2xl border border-accent/25 bg-gradient-to-b from-accent/10 to-accent/[0.03] p-5 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-accent">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                {t('rootCause.label')}
              </div>
              {awaitingApproval && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-background px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {t('status.readyForApproval')}
                </span>
              )}
            </div>
            <p
              data-testid="incident-root-cause-text"
              className="max-w-[72ch] whitespace-pre-wrap text-[15px] leading-relaxed tracking-[-0.005em] text-foreground"
            >
              {incident.rootCause}
            </p>
            {incident.resolution && (
              <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
                <span className="mr-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-accent">
                  {t('rootCause.resolutionLabel')}
                </span>
                {incident.resolution}
              </p>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            {t('rootCause.empty')}
          </section>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <TabButton
            active={activeTab === 'evidences'}
            onClick={() => setActiveTab('evidences')}
            icon={<FileSearch className="h-3.5 w-3.5" aria-hidden="true" />}
            label={t('tabs.evidences')}
            count={allEvidences.length}
          />
          <TabButton
            active={activeTab === 'actions'}
            onClick={() => setActiveTab('actions')}
            icon={<Wrench className="h-3.5 w-3.5" aria-hidden="true" />}
            label={t('tabs.actions')}
            count={flatActions.length}
          />
          <TabButton
            active={activeTab === 'discussion'}
            onClick={() => setActiveTab('discussion')}
            icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}
            label={t('tabs.discussion')}
            count={chatMessages.length}
            testId="incident-chat-tab"
          />
        </div>

        {/* Tab content */}
        {activeTab === 'evidences' ? (
          <>
            <EvidenceToolbar
              search={search}
              onSearchChange={setSearch}
              total={allEvidences.length}
              typeCounts={evidenceTypeCounts}
              activeType={typeFilter}
              onTypeChange={setTypeFilter}
              t={t}
            />

            {hasLoadError ? (
              <EmptyState
                icon={<AlertTriangle className="h-5 w-5" />}
                title={t('empty.loadFailed')}
                sub={t('empty.loadFailedSub')}
              />
            ) : isLoadingDetail ? (
              <EvidenceSkeleton />
            ) : allEvidences.length === 0 ? (
              <EmptyState
                icon={<FileSearch className="h-5 w-5" />}
                title={t('empty.evidenceEmpty')}
                sub={t('empty.evidenceEmptySub')}
              />
            ) : (
              <EvidenceLedger
                groups={groupEvidenceByBucket(filteredEvidenceByAgent, t)}
                startIso={incident.createdAt}
                t={t}
              />
            )}
          </>
        ) : activeTab === 'actions' ? (
          <ActionsTabPanel actions={flatActions} loading={isLoadingRemediations} t={t} />
        ) : (
          <DiscussionPanel
            messages={chatMessages}
            draft={chatDraft}
            onDraftChange={setChatDraft}
            onSend={() => {
              void sendFollowupMessage();
            }}
            isLoading={isLoadingChat}
            isSending={isSendingMessage}
            error={chatError}
            scrollRef={chatScrollRef}
            t={t}
          />
        )}
      </section>

      {/* =============================== RIGHT RAIL =============================== */}
      <aside className="space-y-4 lg:border-l lg:border-border lg:pl-6">
        {awaitingApproval && (
          <section className="rounded-xl border border-warning/25 bg-gradient-to-b from-warning/10 to-warning/[0.03] p-4">
            <div className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warning">
              <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
              {t('rail.planLabel')}
            </div>
            <div className="mb-1 text-[14px] font-bold tracking-tight text-foreground">
              {flatActions.length === 0
                ? t('summary.actions')
                : flatActions.length === 1
                  ? t('rail.planCountOne', { count: flatActions.length })
                  : t('rail.planCountMany', { count: flatActions.length })}
              {autoActionCount > 0 && ` ${t('rail.planAutoSuffix', { count: autoActionCount })}`}
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {t('rail.planDescription')}
            </p>
            {approvalActionsSlot}
          </section>
        )}

        <div
          data-testid="incident-remediations"
          className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
        >
          <span>{t('rail.title')}</span>
          <span
            data-testid="incident-remediations-count"
            className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {flatActions.length}
          </span>
        </div>

        <div className="space-y-3">
          {isLoadingRemediations ? (
            <ActionCardSkeleton />
          ) : flatActions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              {t('empty.actionsRailEmpty')}
            </p>
          ) : (
            flatActions.slice(0, 6).map((a) => <ActionCard key={a.id} action={a} compact t={t} />)
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SummaryStripProps {
  duration: string;
  window: string;
  evidenceTotal: number;
  evidenceSynthesisCount: number;
  evidenceCollectionCount: number;
  toolCalls: number;
  toolNames: string[];
  actionsTotal: number;
  actionsAuto: number;
  actionsManual: number;
  loading: boolean;
  t: Translator;
}

function SummaryStrip({
  duration,
  window: windowLabel,
  evidenceTotal,
  evidenceSynthesisCount,
  evidenceCollectionCount,
  toolCalls,
  toolNames,
  actionsTotal,
  actionsAuto,
  actionsManual,
  loading,
  t,
}: SummaryStripProps) {
  const emptyDash = t('summary.empty');
  const evidenceSub =
    evidenceSynthesisCount > 0
      ? t('summary.evidenceCollectionAndSynthesis', {
          collected: evidenceCollectionCount,
          synthesis: evidenceSynthesisCount,
        })
      : t('summary.evidenceCollectionOnly', { count: evidenceCollectionCount });
  const actionsSub =
    actionsTotal > 0
      ? t('summary.actionsAutoManual', { auto: actionsAuto, manual: actionsManual })
      : emptyDash;
  const toolsSub = toolNames.length > 0 ? toolNames.join(' · ') : emptyDash;
  const loadingSub = t('summary.loading');

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
      <SummaryCell
        icon={<Clock className="h-3 w-3" aria-hidden="true" />}
        label={t('summary.duration')}
        value={duration}
        sub={windowLabel}
      />
      <SummaryCell
        icon={<FileSearch className="h-3 w-3" aria-hidden="true" />}
        label={t('summary.evidences')}
        value={loading ? emptyDash : `${evidenceTotal}`}
        valueSuffix={evidenceTotal > 0 ? t('summary.evidencePieces') : undefined}
        sub={loading ? loadingSub : evidenceSub}
      />
      <SummaryCell
        icon={<Activity className="h-3 w-3" aria-hidden="true" />}
        label={t('summary.toolCalls')}
        value={loading ? emptyDash : `${toolCalls}`}
        sub={loading ? loadingSub : toolsSub}
      />
      <SummaryCell
        icon={<ListChecks className="h-3 w-3" aria-hidden="true" />}
        label={t('summary.actions')}
        value={loading ? emptyDash : `${actionsTotal}`}
        sub={loading ? loadingSub : actionsSub}
      />
    </div>
  );
}

interface SummaryCellProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueSuffix?: string;
  sub?: string;
}

function SummaryCell({ icon, label, value, valueSuffix, sub }: SummaryCellProps) {
  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold tracking-tight text-foreground">
        {value}
        {valueSuffix && (
          <span className="ml-1 font-mono text-[10.5px] font-medium text-muted-foreground">
            {valueSuffix}
          </span>
        )}
      </div>
      {sub && (
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  testId?: string;
}

function TabButton({ active, onClick, icon, label, count, testId }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
      <span
        className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[10.5px] font-bold ${
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

interface EvidenceToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  total: number;
  typeCounts: Record<string, number>;
  activeType: string | null;
  onTypeChange: (v: string | null) => void;
}

function EvidenceToolbar({
  search,
  onSearchChange,
  total,
  typeCounts,
  activeType,
  onTypeChange,
  t,
}: EvidenceToolbarProps & { t: Translator }) {
  const knownTypes = Object.keys(typeCounts).sort();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('toolbar.searchPlaceholder')}
          className="flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <FilterChip
        active={activeType === null}
        onClick={() => onTypeChange(null)}
        label={t('toolbar.allLabel', { count: total })}
        dotClass="bg-muted-foreground"
      />
      {knownTypes.map((typeKey) => {
        const cls = EVIDENCE_TYPE_CLASSES[typeKey] ?? DEFAULT_EVIDENCE_TYPE_CLASS;
        return (
          <FilterChip
            key={typeKey}
            active={activeType === typeKey}
            onClick={() => onTypeChange(activeType === typeKey ? null : typeKey)}
            label={`${EVIDENCE_TYPE_LABEL[typeKey] ?? typeKey} · ${typeCounts[typeKey]}`}
            dotClass={cls.dot}
          />
        );
      })}
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  dotClass: string;
}

function FilterChip({ active, onClick, label, dotClass }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-current opacity-70' : dotClass}`}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}

interface EvidenceLedgerProps {
  groups: Array<{
    key: 'synthesis' | 'investigation';
    label: string;
    sub: string;
    items: InvestigationEvidence[];
  }>;
  startIso: string;
}

function EvidenceLedger({ groups, startIso, t }: EvidenceLedgerProps & { t: Translator }) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-5 w-5" />}
        title={t('empty.filterNoMatch')}
        sub={t('empty.filterNoMatchSub')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <EvidenceGroup key={g.key} group={g} startIso={startIso} t={t} />
      ))}
    </div>
  );
}

function EvidenceGroup({
  group,
  startIso,
  t,
}: {
  group: EvidenceLedgerProps['groups'][number];
  startIso: string;
  t: Translator;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const firstAt = group.items[0]?.createdAt;
  const lastAt = group.items[group.items.length - 1]?.createdAt;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
        aria-expanded={!collapsed}
      >
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            group.key === 'synthesis' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
          }`}
        >
          {group.key === 'synthesis' ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-foreground">
            {group.label}
          </div>
          <div className="text-xs text-muted-foreground">{group.sub}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-[10.5px] font-semibold text-muted-foreground">
          <span>
            {group.items.length}{' '}
            {group.items.length === 1 ? t('groups.pieceOne') : t('groups.pieceMany')}
          </span>
          {firstAt && (
            <span>
              {formatTimeOfDay(firstAt)}
              {lastAt && lastAt !== firstAt && ` → ${formatTimeOfDay(lastAt)}`}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {!collapsed && (
        <div className="py-1">
          {group.items.map((e, idx) => (
            <EvidenceItem
              key={e.evidenceId}
              evidence={e}
              startIso={startIso}
              isFirst={idx === 0}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EvidenceItem({
  evidence,
  startIso,
  isFirst,
  t,
}: {
  evidence: InvestigationEvidence;
  startIso: string;
  isFirst: boolean;
  t: Translator;
}) {
  const typeCls = EVIDENCE_TYPE_CLASSES[evidence.evidenceType] ?? DEFAULT_EVIDENCE_TYPE_CLASS;
  return (
    <article
      className={`grid grid-cols-[76px_1fr] gap-3 px-4 py-3 sm:grid-cols-[96px_1fr_auto] sm:gap-4 ${
        isFirst ? '' : 'border-t border-dashed border-border'
      }`}
    >
      <div className="font-mono text-[10.5px] font-semibold leading-relaxed text-muted-foreground">
        <div className="text-foreground/80">{formatTimeOfDay(evidence.createdAt)}</div>
        <div className="mt-0.5 text-[9.5px] opacity-70">
          {formatRelativeFromStart(startIso, evidence.createdAt)}
        </div>
      </div>

      <div className="min-w-0">
        {evidence.claim && (
          <p className="text-[13.5px] leading-relaxed text-foreground">{evidence.claim}</p>
        )}
        {!evidence.claim && evidence.content && (
          <p className="text-[13.5px] leading-relaxed text-foreground">
            {truncate(evidence.content, 280)}
          </p>
        )}
        {evidence.quote && (
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-r-md border-l-2 border-foreground/20 bg-muted/40 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-foreground/90">
            {evidence.quote}
          </pre>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] ${typeCls.tag}`}
          >
            {EVIDENCE_TYPE_LABEL[evidence.evidenceType] ?? evidence.evidenceType}
          </span>
          {evidence.metadata?.toolName && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {evidence.metadata.toolName}
            </span>
          )}
          {evidence.toolCallId && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] text-muted-foreground">
              {t('item.toolCallIdLabel')} {evidence.toolCallId.slice(0, 12)}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] text-muted-foreground">
            {t('item.evidenceIdLabel')} {evidence.evidenceId.slice(0, 8)}
          </span>
        </div>
      </div>

      {SYNTHESIS_ROLES.has(evidence.agentRole) ? (
        <span className="hidden shrink-0 items-center self-start rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10.5px] font-bold text-primary sm:inline-flex">
          {t('item.plusRootCause')}
        </span>
      ) : (
        <span className="hidden shrink-0 items-center self-start rounded-full bg-success/10 px-2 py-0.5 font-mono text-[10.5px] font-bold text-success sm:inline-flex">
          {t('item.plusSupports')}
        </span>
      )}
    </article>
  );
}

interface ActionsTabPanelProps {
  actions: ReturnType<typeof deriveActionsFromRemediations>;
  loading: boolean;
  t: Translator;
}

function ActionsTabPanel({ actions, loading, t }: ActionsTabPanelProps) {
  if (loading) return <ActionCardSkeleton />;
  if (actions.length === 0) {
    return (
      <EmptyState
        icon={<Wrench className="h-5 w-5" />}
        title={t('empty.actionsEmpty')}
        sub={t('empty.actionsEmptySub')}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {actions.map((a) => (
        <ActionCard key={a.id} action={a} t={t} />
      ))}
    </div>
  );
}

const RISK_CLASSES: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-success/10 text-success',
  medium: 'bg-warning/15 text-warning',
  high: 'bg-destructive/10 text-destructive',
};

function ActionCard({
  action,
  compact = false,
  t,
}: {
  action: ReturnType<typeof deriveActionsFromRemediations>[number];
  compact?: boolean;
  t: Translator;
}) {
  const riskCls = RISK_CLASSES[action.riskLevel];
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-muted-foreground/50">
      <div className="mb-2 text-[13px] font-semibold leading-snug tracking-tight text-foreground">
        {action.title}
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {action.automated ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.04em] text-accent">
            <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
            {t('action.auto')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.04em] text-primary">
            <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
            {t('action.manual')}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.04em] ${riskCls}`}
        >
          <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
          {t('action.risk')} · {action.riskLevel}
        </span>
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
          {action.status}
        </span>
      </div>
      {!compact && action.description && (
        <p className="mb-2 text-[12px] leading-relaxed text-muted-foreground">
          {truncate(action.description, 180)}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border pt-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold text-muted-foreground">
          {action.automated ? (
            <>
              <PlayCircle className="h-3 w-3" aria-hidden="true" />
              {t('action.readyToRun')}
            </>
          ) : (
            <>
              <Users className="h-3 w-3" aria-hidden="true" />
              {t('action.needsOnCall')}
            </>
          )}
        </span>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
            action.automated
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border border-border bg-card text-foreground hover:border-muted-foreground'
          }`}
        >
          <Hammer className="h-3 w-3" aria-hidden="true" />
          {action.automated ? t('action.execute') : t('action.assign')}
        </button>
      </div>
    </div>
  );
}

function EvidenceSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonGroup />
      <SkeletonGroup />
    </div>
  );
}

function SkeletonGroup() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-60 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function ActionCardSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
      <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

interface DiscussionPanelProps {
  messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  t: Translator;
}

function DiscussionPanel({
  messages,
  draft,
  onDraftChange,
  onSend,
  isLoading,
  isSending,
  error,
  scrollRef,
  t,
}: DiscussionPanelProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <section
      data-testid="incident-chat-panel"
      className="flex h-[540px] flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        ref={scrollRef}
        data-testid="incident-chat-messages"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('chat.loadingHistory')}
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="h-5 w-5" />}
            title={t('chat.empty')}
            sub={t('chat.emptySub')}
          />
        ) : (
          messages.map((m, i) => <ChatBubble key={`${m.createdAt}-${i}`} message={m} t={t} />)
        )}
      </div>
      {error && (
        <div className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="shrink-0 border-t border-border bg-muted/30 p-3">
        <div className="flex items-end gap-2">
          <textarea
            data-testid="incident-chat-input"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('chat.placeholder')}
            rows={2}
            disabled={isSending}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
          <button
            type="button"
            data-testid="incident-chat-send"
            onClick={onSend}
            disabled={!draft.trim() || isSending}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {t('chat.send')}
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">{t('chat.hint')}</p>
      </div>
    </section>
  );
}

function ChatBubble({
  message,
  t,
}: {
  message: { role: 'user' | 'assistant'; content: string; createdAt: string };
  t: Translator;
}) {
  const isUser = message.role === 'user';
  return (
    <div
      data-testid={isUser ? 'incident-chat-user' : 'incident-chat-assistant'}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-muted/40 text-foreground'
        }`}
      >
        <div className="mb-0.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] opacity-75">
          {isUser ? t('chat.userLabel') : t('chat.assistantLabel')}
          <span className="font-normal opacity-70">· {formatTimeOfDay(message.createdAt)}</span>
        </div>
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  );
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max).trimEnd()}…`;
}
