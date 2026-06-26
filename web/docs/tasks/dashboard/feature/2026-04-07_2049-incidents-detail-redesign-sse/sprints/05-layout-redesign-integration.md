# Sprint 5: Layout Redesign + Integration

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 5 of 5
- **Depends on:** Sprint 3 (LiveActivityTimeline) AND Sprint 4 (four-state empty states)
- **Batch:** 3 (sequential — final integration sprint)
- **Model:** sonnet
- **Estimated effort:** M/L

## Objective

Replace the flat single-column `incident-detail.tsx` with the new responsive 2-column layout: sticky status header, narrative on the left, sticky status panel + live activity timeline on the right. Wire `useIncidentStream` to the layout, integrate the Sprint 3 timeline, and pass `incidentStatus` to the Sprint 4 four-state empty states. Update i18n with the layout-related keys. Final visual review pass at all breakpoints.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-status-panel.tsx` — sticky status panel containing title, badges, severity, primary CTA, and connection state indicator.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-narrative.tsx` — wraps Description / Root Cause / Resolution / Timestamps / Assigned Agents into one ordered narrative section.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-action-bar.tsx` — primary CTA bar (start triage / start investigation / abort / mark resolved). Pure presentational; receives all handlers as props.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/incident-status-panel.test.tsx` — RTL test.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/incident-narrative.test.tsx` — RTL test.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/incident-action-bar.test.tsx` — RTL test.

### Modifies (can touch)

- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` — full refactor: < 250 lines, delegates to new sub-components, integrates `useIncidentStream`, two-column responsive layout, passes `incidentStatus` and `rootCause` to `<RemediationsSection>`.
- `apps/dashboard/src/contexts/investigation/infrastructure/i18n/en.json` — add layout-related keys: `dashboard.incidents.detail.liveActivity.title`, `liveActivity.empty`, `liveActivity.history`, `agents.log_analyst`, `agents.metric_analyst`, `agents.infra_inspector`, `agents.orchestrator`, `agents.scout`, `agents.diagnosis_verifier`, `stream.connecting`, `stream.disconnected`, `stream.error`, `stream.reconnect`, `stream.devUnavailable`.
- `apps/dashboard/src/contexts/investigation/infrastructure/i18n/pt-br.json` — same keys with PT-BR translations.
- `apps/dashboard/CLAUDE.md` — update the bounded contexts table for `investigation` to mention the new `incident-detail/` sub-folder.

### Read-Only (reference but do NOT modify)

- All Sprint 1 files: `domain/incident-stream-types.ts`, `presentation/hooks/use-incident-stream.ts`, `presentation/components/incident-detail/disconnected-banner.tsx`.
- All Sprint 3 files: `live-activity-timeline.tsx`, `agent-step-card.tsx`, the mappers and meta in `lib/`.
- All Sprint 4 files: `remediations-empty-state.tsx`, `feedback-empty-state.tsx`, the modified `remediations-section.tsx` and `incident-feedback.tsx`.
- `apps/dashboard/src/contexts/investigation/domain/types.ts` — for `Incident`, `IncidentStatus`.
- `apps/dashboard/src/contexts/investigation/presentation/components/{status-badge,known-solution-banner,remediation-status-badge}.tsx` — re-used as-is.
- `packages/ui/src/components/*` — for any Shadcn primitives we want (`Card`, `Skeleton`, etc.).

### Shared Contracts (consume from prior sprints or PRD)

- `UseIncidentStreamResult` from Sprint 1.
- `<LiveActivityTimeline>` API from Sprint 3.
- `<RemediationsEmptyState>` and the modified `<RemediationsSection>` API from Sprint 4 (now requires `incidentStatus` to render the correct branch).
- `IncidentStatus` from `domain/types.ts`.

### Consumed Invariants (from INVARIANTS.md)

- `Polling forbidden in incident-detail` — final refactor must keep zero polling.
- `Loading... literal banned` — must not reintroduce.
- `No barrel imports` — direct deep paths only.

## Tasks

- [x] Add the new i18n keys to `en.json` under `dashboard.incidents.detail`:
  ```
  liveActivity: {
    title: "Live Activity",
    empty: "No agent activity recorded yet",
    history: "History"
  }
  agents: {
    log_analyst: "Log Analyst",
    metric_analyst: "Metric Analyst",
    infra_inspector: "Infrastructure Inspector",
    orchestrator: "Orchestrator",
    scout: "Scout",
    diagnosis_verifier: "Diagnosis Verifier"
  }
  stream: {
    connecting: "Connecting to live updates...",
    disconnected: "Live updates disconnected",
    error: "Could not connect to live updates",
    reconnect: "Reconnect",
    devUnavailable: "Live updates not available in dev mode"
  }
  ```
- [x] Add the same keys to `pt-br.json` with PT-BR translations.
- [x] Create `incident-action-bar.tsx`:
  - Props: `{ incident: Incident; isRerunning: boolean; isTriaging: boolean; isInvestigating: boolean; isAborting: boolean; showAbortConfirm: boolean; onRerun: () => void; onStartTriage: () => void; onStartInvestigation: () => void; onAbortRequest: () => void; onAbortConfirm: () => void; onAbortCancel: () => void }`.
  - Renders the appropriate buttons based on `incident.status`. Pure presentational — no fetch or state.
  - Extracts the existing button JSX from the current `incident-detail.tsx` lines ~265-349.
- [x] Create `incident-status-panel.tsx`:
  - Props: `{ incident: Incident; streamStatus: IncidentStreamStatus; onReconnect: () => void; actionBar: ReactNode }`.
  - Renders title, status badges, severity, source label, created-at, the action bar (passed in as a prop), and a small connection-state pill (e.g. green dot when connected, amber when disconnected).
  - Uses `position: sticky; top: 1rem` on `lg:` breakpoint via Tailwind classes.
- [x] Create `incident-narrative.tsx`:
  - Props: `{ incident: Incident }`.
  - Renders Description, Root Cause, Resolution, Assigned Agents, Timestamps in this order — each as a `<section>` with the same card treatment as today.
  - Returns `null` for any section that has no data (don't render empty cards).
- [x] Refactor `incident-detail.tsx`:
  - Top-level: `const stream = useIncidentStream(incident.incidentId)`.
  - All POST handlers (`handleRerun`, `handleStartTriage`, `handleStartInvestigation`, `handleAbortInvestigation`, `handleKnownSolutionResponse`) stay in this file but the JSX is delegated.
  - Wire SSE subscriptions: `stream.on('incident.status_changed', () => fetchIncident())`, `stream.on('investigation.completed', () => fetchIncident())`, `stream.on('remediation.proposed', () => fetchIncident())`.
  - Layout structure:
    ```tsx
    <div className="mx-auto max-w-7xl space-y-4 lg:space-y-6 px-4 lg:px-0">
      <BackLink />
      {stream.status !== 'connected' && <DisconnectedBanner ... />}
      {incident.knownSolutionStatus === 'pending' && <KnownSolutionBanner ... />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8 space-y-4 lg:space-y-6">
          <IncidentNarrative incident={incident} />
          <RemediationsSection incidentId={incident.incidentId} incidentStatus={incident.status} rootCause={incident.rootCause} />
          <IncidentFeedback incidentId={incident.incidentId} />
        </div>
        <div className="lg:col-span-4 space-y-4">
          <IncidentStatusPanel incident={incident} streamStatus={stream.status} onReconnect={stream.reconnect} actionBar={<IncidentActionBar ... />} />
          <LiveActivityTimeline incidentId={incident.incidentId} stream={stream} />
        </div>
      </div>
    </div>
    ```
  - The body of the file should be < 250 lines (run `wc -l` to verify).
- [x] Update `apps/dashboard/CLAUDE.md`:
  - In the "Bounded Contexts" table for `investigation`, mention the new `presentation/components/incident-detail/` sub-folder and what it contains: `disconnected-banner`, `live-activity-timeline`, `agent-step-card`, `incident-status-panel`, `incident-narrative`, `incident-action-bar`, `remediations-empty-state`, `feedback-empty-state`, plus `lib/agent-role-meta.ts` and `lib/agent-step-mappers.ts`.
- [x] Tests:
  - `incident-status-panel.test.tsx`: renders all status states; sticky class present at `lg:`; connection-state pill changes color.
  - `incident-narrative.test.tsx`: renders all sections when data is present; omits sections when data is missing.
  - `incident-action-bar.test.tsx`: renders the right buttons for each `incident.status`; click handlers fire with correct args.
  - Manual visual smoke test (sprint executor only checks compile/lint/types — orchestrator does the visual review post-merge).

## Acceptance Criteria

- [x] `incident-detail.tsx` is < 250 lines (verified by `wc -l`).
- [x] The page renders correctly at viewports 375 / 640 / 768 / 1024 / 1280 / 1536 px (orchestrator manually verifies after merge).
- [x] Sticky status panel visible on desktop scroll (`lg:` breakpoint).
- [x] Live activity timeline streams updates without polling.
- [x] All existing buttons and CTAs still work (Triage, Investigate, Abort, Rerun, Known Solution Accept/Decline, Approve/Reject/Execute Remediation, Submit Feedback).
- [x] `<RemediationsSection>` is called with `incidentStatus={incident.status}` and `rootCause={incident.rootCause}`.
- [x] All build / lint / type-check / test commands pass.
- [x] No literal `"Loading..."` strings remain in `apps/dashboard/src/contexts/investigation/`.
- [x] No `setInterval` or `POLL_INTERVAL_MS` references in `incident-detail.tsx`.

## Verification

- [x] `pnpm exec biome check apps/dashboard/src/contexts/investigation/`
- [x] `pnpm turbo check-types --filter=dashboard`
- [x] `pnpm vitest run apps/dashboard/src/contexts/investigation`
- [x] `pnpm turbo build --filter=dashboard`
- [x] `wc -l apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` outputs `< 250`.
- [x] All invariants in `INVARIANTS.md` Section 13 pass.

> **Note:** Dev server smoke test and content verification are handled by the orchestrator after merge — do not run in the sprint-executor. Sprint-executors do static verification only.

## Context

- This is the integration sprint. Every prior sprint produced isolated pieces; this sprint composes them.
- The current `incident-detail.tsx` (442 lines) has all action handlers, all section JSX, and the polling logic in one file. The refactor extracts everything BUT the action handlers into sub-components. The handlers stay because (a) they call `fetchIncident` directly and (b) they manage local state (`isRerunning`, etc.) — moving them to children would require lifting state up anyway.
- The 2-column grid uses Tailwind v4 grid utilities. The 8/4 split is intentional: narrative content needs more horizontal room; the status panel + timeline are dense and look better in a narrow column.
- The sticky behavior on desktop uses `lg:sticky lg:top-4` on the right column wrapper. The right column is its own grid item, so sticky works without absolute positioning hacks.
- Mobile-first: at < 1024px the layout collapses to a single column, status panel pinned to the top, then narrative, then timeline at the bottom.
- Update `CLAUDE.md` is mandatory per the project's "Documentation Update Rules" — adding new files in a context counts as a "new component" change.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
