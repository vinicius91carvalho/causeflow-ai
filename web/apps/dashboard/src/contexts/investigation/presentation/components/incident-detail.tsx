'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Incident, IncidentStatus } from '@/contexts/investigation/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { Link } from '@/i18n/navigation';
import { useIncidentActions } from '../hooks/use-incident-actions';
import { useIncidentStream } from '../hooks/use-incident-stream';
import { EvidenceReviewView } from './incident-detail/evidence-review-view';
import { HypothesisDebateView } from './incident-detail/hypothesis-debate-view';
import { IncidentActionBar } from './incident-detail/incident-action-bar';
import { IncidentHeader } from './incident-detail/incident-header';
import { IncidentInconclusivePanel } from './incident-detail/inconclusive-panel';
import { RootCauseCard } from './incident-detail/root-cause-card';
import { IncidentFeedback } from './incident-feedback';
import { InvestigationLiveFeed } from './investigation-live-feed';
import { KnownSolutionBanner } from './known-solution-banner';
import { RemediationsSection } from './remediations-section';

interface IncidentDetailProps {
  initialIncident: Incident;
}

const LIVE_STATUSES: ReadonlySet<IncidentStatus> = new Set<IncidentStatus>([
  'open',
  'triaging',
  'investigating',
  'awaiting_approval', // Worker stays in idle mode for 30 min after completing — keep relay alive
]);

const POLL_INTERVAL_MS = 5000;

export function IncidentDetail({ initialIncident }: IncidentDetailProps) {
  const t = useTranslations('dashboard.incidents.detail');
  const { addToast } = useToast();
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const previousStatusRef = useRef<IncidentStatus>(initialIncident.status);
  const wsConnectedRef = useRef(false);

  const fetchIncident = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyses/${incident.incidentId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { incident: Incident };
      const updated = data.incident;

      if (LIVE_STATUSES.has(previousStatusRef.current) && updated.status === 'resolved') {
        addToast(t('incidentResolved'), 'success');
      }
      previousStatusRef.current = updated.status;
      setIncident(updated);
    } catch {
      /* silently ignore */
    }
  }, [incident.incidentId, addToast, t]);

  // Live SSE from Core via /api/incidents/[id]/stream (AC-025 / AC-056). Opens an
  // EventSource so per-agent events (log, metric, change, code, infra, db)
  // reach the client as they complete; status events trigger a refresh.
  const stream = useIncidentStream(incident.incidentId);
  const [sseProgressLabel, setSseProgressLabel] = useState<string | null>(null);
  useEffect(() => {
    const unsubs = [
      stream.on('incident.status_changed', () => {
        void fetchIncident();
      }),
      stream.on('incident.updated', () => {
        void fetchIncident();
      }),
      stream.on('investigation.started', (evt) => {
        const msg =
          typeof evt.data.message === 'string'
            ? evt.data.message
            : typeof evt.data.stage === 'string'
              ? evt.data.stage
              : 'Investigation started';
        setSseProgressLabel(msg);
        void fetchIncident();
      }),
      stream.on('investigation.progress', (evt) => {
        const msg =
          typeof evt.data.message === 'string'
            ? evt.data.message
            : typeof evt.data.stage === 'string'
              ? String(evt.data.stage)
              : typeof evt.data.agentRole === 'string'
                ? `Agent ${evt.data.agentRole}`
                : 'Investigation progress';
        setSseProgressLabel(msg);
        void fetchIncident();
      }),
      stream.on('investigation.completed', () => {
        setSseProgressLabel('Investigation completed');
        void fetchIncident();
      }),
      stream.on('investigation.failed', () => {
        setSseProgressLabel('Investigation failed');
        void fetchIncident();
      }),
      stream.on('investigation.aborted', () => {
        void fetchIncident();
      }),
      stream.on('remediation.proposed', () => {
        setRemediationRefreshKey((k) => k + 1);
        void fetchIncident();
      }),
      stream.on('agent.completed', (evt) => {
        const role = typeof evt.data.agentRole === 'string' ? evt.data.agentRole : 'agent';
        setSseProgressLabel(`Agent ${role} completed`);
        void fetchIncident();
      }),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [stream, fetchIncident]);

  // Poll as fallback ONLY when WebSocket is not connected
  useEffect(() => {
    if (!LIVE_STATUSES.has(incident.status)) return;
    if (wsConnectedRef.current) return; // WS handles updates — skip polling
    const id = setInterval(() => {
      void fetchIncident();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [incident.status, fetchIncident]);

  // Callbacks from InvestigationLiveFeed — WS pushes status changes
  const handleWsConnectionChange = useCallback((connected: boolean) => {
    wsConnectedRef.current = connected;
  }, []);

  const handleWsStatusChange = useCallback(() => {
    void fetchIncident();
  }, [fetchIncident]);

  // Bumped whenever the WS relay reports a hypothesis-set mutating
  // progress event (seeker / judge / reseek). The HypothesisDebateView
  // watches this and refetches — lets the UI show intermediate state
  // (e.g. 3 pending hypotheses right after seeker) without polling.
  const [hypothesisRefreshKey, setHypothesisRefreshKey] = useState(0);
  const handleHypothesisProgress = useCallback(() => {
    setHypothesisRefreshKey((k) => k + 1);
  }, []);
  const [remediationRefreshKey, setRemediationRefreshKey] = useState(0);

  const isInProgress = LIVE_STATUSES.has(incident.status);
  const isEvidenceReview =
    incident.status === 'awaiting_approval' || incident.status === 'resolved';
  const isInconclusive = incident.status === 'inconclusive';

  const actions = useIncidentActions({ incident, refresh: fetchIncident });

  const actionBar = (
    <IncidentActionBar
      incident={incident}
      isRerunning={actions.isRerunning}
      isTriaging={actions.isTriaging}
      isInvestigating={actions.isInvestigating}
      isAborting={actions.isAborting}
      showAbortConfirm={actions.showAbortConfirm}
      onRerun={() => {
        void actions.handleRerun();
      }}
      onStartTriage={() => {
        void actions.handleStartTriage();
      }}
      onStartInvestigation={() => {
        void actions.handleStartInvestigation();
      }}
      onStartInvestigationWithMode={(mode) => {
        void actions.handleStartInvestigationWithMode(mode);
      }}
      onAbortRequest={() => actions.setShowAbortConfirm(true)}
      onAbortConfirm={() => {
        actions.setShowAbortConfirm(false);
        void actions.handleAbortInvestigation();
      }}
      onAbortCancel={() => actions.setShowAbortConfirm(false)}
    />
  );

  return (
    // Fixed-viewport layout at sm+ breakpoints: the page fits exactly into the
    // remaining space under the dashboard topbar + breadcrumbs and does NOT
    // introduce document-level scroll. The live-feed wrapper (`flex-1 min-h-0`)
    // absorbs the remaining vertical space while header/remediations/feedback
    // stay `shrink-0`. On mobile (<sm) we fall back to natural flow because the
    // stacked shrink-0 sections can push the feed to zero height.
    //
    // Height math (from dashboard-layout.tsx): topbar `h-16` (4rem) + breadcrumbs
    // bar (~2.25rem) + main `lg:p-8` padding (4rem total) ≈ 10.25rem chrome at lg.
    // At sm: `sm:p-6` (3rem) → ~9.25rem; we subtract 10.25rem so the inner height
    // fits within `<main>` at every sm+ breakpoint without exposing a scroll.
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 lg:px-0 sm:h-[calc(100dvh-10.25rem)] sm:overflow-hidden">
      {/* Back link */}
      <Link
        href="/dashboard/incidents"
        className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← {t('back')}
      </Link>

      {/* Known Solution banner — full width */}
      {incident.knownSolutionStatus === 'pending' && incident.knownSolution && (
        <div className="shrink-0">
          <KnownSolutionBanner
            knownSolution={incident.knownSolution}
            onAccept={async () => {
              await actions.handleKnownSolutionResponse('accepted');
            }}
            onDecline={async () => {
              await actions.handleKnownSolutionResponse('declined');
            }}
          />
        </div>
      )}

      {isInconclusive ? (
        // Inconclusive — investigation ran but could not reach a conclusion.
        // Shows a dedicated warning panel with explanation and next steps.
        <div className="flex-1 min-h-0 overflow-y-auto">
          <IncidentInconclusivePanel incident={incident} />

          <div className="mt-6">
            <IncidentFeedback incidentId={incident.incidentId} />
          </div>
        </div>
      ) : isEvidenceReview ? (
        // Evidence Review — post-investigation layout. Owns its own data
        // (evidences via /api/investigation/[id]/detail, actions via
        // /api/remediations) so it can compute real summary counts, filter
        // chips, and grouped evidence ledger. Live feed is skipped because
        // the investigation is finished at this point.
        <div className="flex-1 min-h-0 overflow-y-auto">
          <EvidenceReviewView incident={incident} approvalActionsSlot={actionBar} />

          <div className="mt-6">
            <IncidentFeedback incidentId={incident.incidentId} />
          </div>
        </div>
      ) : (
        <>
          {/* Compact header: title + badges + actions + collapsible details */}
          <div className="shrink-0">
            <IncidentHeader incident={incident} actionBar={actionBar} />
            {(sseProgressLabel || stream.status === 'connected') && (
              <p
                data-testid="incident-sse-progress"
                className="mt-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {sseProgressLabel
                  ? sseProgressLabel
                  : stream.status === 'connected'
                    ? 'Live investigation stream connected'
                    : null}
              </p>
            )}
          </div>

          {/* Hypothesis / debate modes render a structured view that subsumes
              the root-cause card (winner + rejected + evidence). Orchestrator
              mode keeps the simpler headline card. */}
          <div className="shrink-0">
            {incident.investigationMode && incident.investigationMode !== 'orchestrator' ? (
              <HypothesisDebateView
                incidentId={incident.incidentId}
                mode={incident.investigationMode}
                status={incident.status}
                refreshKey={hypothesisRefreshKey}
              />
            ) : (
              <RootCauseCard incident={incident} />
            )}
          </div>

          {/* Live Feed flexes to fill the remaining viewport. `min-h-0` is the
              canonical unlock for a flex child that contains `overflow-y-auto`. */}
          <div className="flex-1 min-h-0 overflow-hidden sm:flex sm:flex-col">
            <InvestigationLiveFeed
              incidentId={incident.incidentId}
              isInProgress={isInProgress || incident.status === 'resolved'}
              onStatusChange={handleWsStatusChange}
              onConnectionChange={handleWsConnectionChange}
              onHypothesisProgress={handleHypothesisProgress}
            />
          </div>

          {/* Remediations — pinned above feedback; auto-hidden when empty */}
          <div className="shrink-0">
            <RemediationsSection
              incidentId={incident.incidentId}
              incidentStatus={incident.status}
              rootCause={incident.rootCause}
              refreshKey={remediationRefreshKey}
              hideWhenEmpty
            />
          </div>

          {/* Feedback pinned at the bottom of the viewport at sm+ */}
          <div className="shrink-0">
            <IncidentFeedback incidentId={incident.incidentId} />
          </div>
        </>
      )}
    </div>
  );
}
