# Incidents — Feature Components

Feature components that build the dashboard incidents surface. These are domain-aware compositions owned by the `investigation` bounded context; they are NOT reusable primitives. Source: `apps/dashboard/src/contexts/investigation/presentation/components/`.

## Page Flow

The incidents surface has two routes:

1. `apps/dashboard/src/app/[locale]/dashboard/incidents/page.tsx` — list view. The route file is a thin re-export; the real page lives in `apps/dashboard/src/contexts/investigation/presentation/pages/incidents-page.tsx`. It renders a page title, a primary "+ New incident" link (`incidents-page.tsx:32-38`), and the paginated `<IncidentsList>`.
2. `apps/dashboard/src/app/[locale]/dashboard/incidents/[id]/page.tsx` — detail view. The client container is `IncidentDetail` (`components/incident-detail.tsx`). Its JSX is the authoritative page flow reference.

Detail-view composition order (top → bottom, `incident-detail.tsx:116-199`):

1. Back link to `/dashboard/incidents`
2. `KnownSolutionBanner` (conditional — only when a pending known solution matches)
3. `IncidentHeader` with an inline `IncidentActionBar` passed as `actionBar`
4. Either `HypothesisDebateView` (hypothesis / debate modes) or `RootCauseCard` (orchestrator mode) — selected by `incident.investigationMode`
5. `InvestigationLiveFeed` — flexes to fill remaining viewport height
6. `RemediationsSection` (auto-hidden when empty, uses `RemediationsEmptyState` internally)
7. `IncidentFeedback` (uses `FeedbackEmptyState` internally)

At `sm+` breakpoints the outer container is `h-[calc(100dvh-10.25rem)] overflow-hidden` so the page is fixed-viewport. On mobile it falls back to natural flow.

---

## IncidentHeader

Compact top strip for the detail page: title, `StatusBadge`, `SeverityBadge`, source-provider pill, creation timestamp, and the injected `actionBar`. A `Details` toggle chevron expands a collapsible section (CSS grid `grid-template-rows` animation, `incident-header.tsx:56-58`) containing description, resolution, updated-at, and `sourceAlertId`.

| Prop | Type | Description |
|---|---|---|
| `incident` | `Incident` | Current incident domain model |
| `actionBar` | `ReactNode` | Injected action bar — parent owns handlers so they can share `fetchIncident` |

**Accessibility:** The `Details` toggle is a native `<button>`; the chevron uses `rotate-90` to reflect state. Source-provider pill does not have `role`; it's purely decorative metadata (live regions are not needed because changes happen after navigation).

**Appears in:** `incident-detail.tsx:154`.

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-header.tsx`

---

## IncidentStatusPanel

Right-column panel that mirrors the header's title/status/severity/source summary plus the injected `actionBar`. It is the alternate placement when a side-rail layout is desired.

| Prop | Type | Description |
|---|---|---|
| `incident` | `Incident` | Domain model |
| `actionBar` | `ReactNode` | Parent-owned action bar |

**Accessibility:** Root is an `<aside>` for landmark semantics. Uses `StatusBadge`/`SeverityBadge` primitives for tone.

**Appears in:** Currently not wired into the live detail container (superseded by `IncidentHeader` on the incidents detail page). Retained for alternate layouts. Flag as drift — see summary.

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-status-panel.tsx`

---

## IncidentTimestamps

Compact `<dl>` listing the lifecycle dates: `createdAt`, `updatedAt`, `resolvedAt` (conditional), and `sourceAlertId` (conditional, monospace).

| Prop | Type | Description |
|---|---|---|
| `incident` | `Incident` | Domain model |

**Accessibility:** Uses semantic `<dl>`/`<dt>`/`<dd>`; no interactive elements. All text derives from `next-intl` translations (`dashboard.incidents.detail.*`).

**Appears in:** Intended for a right-column placement adjacent to `IncidentStatusPanel`. Not currently composed into the live detail flow (header already surfaces `createdAt`/`updatedAt` in its collapsible section). Flag as drift.

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-timestamps.tsx`

---

## HypothesisDebateView

Structured read-only view of the investigation's hypothesis tree for `hypothesis` and `debate` modes. Renders three regions: a green `WinnerCard` for the confirmed hypothesis (with statement, rationale, `InformedBy` tags, `ConfidenceBar`, split `evidenceFor` / `evidenceAgainst` lists with weight pills), a `PendingStack` (indigo), and a collapsible `RejectedStack` (audit trail).

| Prop | Type | Description |
|---|---|---|
| `incidentId` | `string` | Incident to fetch hypotheses for |
| `mode` | `InvestigationModeName \| undefined` | `'orchestrator' \| 'hypothesis' \| 'debate'` — returns `null` if `undefined` or `'orchestrator'` |
| `status` | `string` | Current incident status. Changes trigger a refetch |
| `refreshKey` | `string \| number \| undefined` | Opaque token parent bumps to force a refetch on intermediate WS events (e.g. `judge_complete`) |

**Data refresh model (`hypothesis-debate-view.tsx:63-84`):** fetch on mount, refetch when `status` or `refreshKey` changes. No polling — the parent's WS relay is the source of truth.

**Accessibility:** `RejectedStack` toggle exposes `aria-expanded`. `ConfidenceBar` is a `role="progressbar"` with `aria-valuenow`/`min`/`max` and `aria-label`. Rejected hypotheses use `line-through` with a visible `XCircle` icon so the state is not conveyed by strikethrough alone. Loading skeleton carries `aria-busy="true"`.

**Appears in:** `incident-detail.tsx:162` (when `investigationMode !== 'orchestrator'`).

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/hypothesis-debate-view.tsx`

---

## RootCauseCard

Single-hypothesis alternate shown when the incident ran under orchestrator mode. Has three branches (`root-cause-card.tsx:32-95`):

1. No `rootCause` + not investigating → renders `null`
2. No `rootCause` + investigating → dashed indigo "still investigating" card with spinner
3. Has `rootCause` → solid purple (open/triaging) or green (resolved/closed) card with a "Root cause identified" pill, the root-cause text, and a Show more / Show less toggle for bodies longer than 320 chars

| Prop | Type | Description |
|---|---|---|
| `incident` | `Incident` | Domain model |

**Accessibility:** Investigating card uses `aria-live="polite"` so screen readers announce transitions. Expand toggle carries `aria-expanded`. Icons are `aria-hidden`.

**Appears in:** `incident-detail.tsx:169` (when `investigationMode === 'orchestrator'` or absent).

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/root-cause-card.tsx`

---

## IncidentNarrative

Descriptive block composed of up to three stacked cards: Description, Root Cause, Resolution. Empty sections are omitted entirely (`incident-narrative.tsx:20-53`) to keep the layout dense.

| Prop | Type | Description |
|---|---|---|
| `incident` | `Incident` | Domain model |

**Accessibility:** Uses `<section>` + `<h3>` per card for landmark structure. Pre-line formatting preserved via `whitespace-pre-wrap`.

**Appears in:** Not currently composed into `incident-detail.tsx` — header's collapsible details and `RootCauseCard` / `HypothesisDebateView` cover the same ground. Flag as drift.

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-narrative.tsx`

---

## IncidentActionBar

Pure presentational action bar that switches button sets by `incident.status`. States (`incident-action-bar.tsx:54-161`):

- `open` → "Start Triage" + "Start Investigation" + (staff-only) `InvestigationModeSelector`
- `investigating` → "Abort investigation" with an inline confirm panel
- `resolved` / `closed` → "+ Rerun"

All handlers are injected; no fetch, no local state except the confirm panel is driven by the parent via `showAbortConfirm`.

| Prop | Type | Description |
|---|---|---|
| `incident` | `Incident` | Used only to read `status` |
| `isRerunning` / `isTriaging` / `isInvestigating` / `isAborting` | `boolean` | Disables buttons + swaps in `Loader2` spinner |
| `showAbortConfirm` | `boolean` | Toggles the inline abort confirmation block |
| `onRerun` / `onStartTriage` / `onStartInvestigation` | `() => void` | Action handlers |
| `onStartInvestigationWithMode` | `(mode: InvestigationModeName) => void` | Staff-only: runs with explicit mode |
| `onAbortRequest` / `onAbortConfirm` / `onAbortCancel` | `() => void` | Abort flow handlers |

**Accessibility:** Buttons have explicit `type="button"` and `disabled` wiring. Abort confirmation copy is inline (not a modal) so focus ordering is preserved. Spinner icons are `aria-hidden`. Staff gate uses `useIsStaff()` — tenant operators never see `InvestigationModeSelector`.

**Appears in:** `incident-detail.tsx:88-114`, passed into `IncidentHeader` via `actionBar`.

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-action-bar.tsx`

---

## RemediationsEmptyState

Three explicit empty states for the Remediations section, replacing the earlier generic "no remediations yet" copy.

| Prop | Type | Description |
|---|---|---|
| `state` | `'pending' \| 'completed-empty' \| 'error'` | Which branch to render |
| `rootCause` | `string \| undefined` | Optional — changes copy for `completed-empty` |
| `onRetry` | `() => void \| undefined` | Required for `error`; renders a Retry button |

**Accessibility:** Error branch uses `role="alert"`. All branches set `data-testid="remediations-empty-state"` + `data-state="..."` for E2E. `Clock` icon uses `animate-pulse` on pending.

**Appears in:** Rendered by `RemediationsSection` when the post-fetch result set is empty.

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/remediations-empty-state.tsx`

---

## FeedbackEmptyState

Two-state empty / error display for `IncidentFeedback`.

| Prop | Type | Description |
|---|---|---|
| `state` | `'empty' \| 'error'` | Branch |
| `onRetry` | `() => void \| undefined` | Required for `error` |

**Accessibility:** Error branch uses `role="alert"`. Both branches expose `data-testid="feedback-empty-state"` + `data-state`.

**Appears in:** `IncidentFeedback` (`incident-feedback.tsx`).

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/feedback-empty-state.tsx`

---

## DisconnectedBanner

Surfaces the SSE stream connection state (`connected` → renders nothing, `connecting` → blue loading pill, `disconnected` / `error` → amber alert with Retry). There is no automatic reconnect — the user must click Retry.

| Prop | Type | Description |
|---|---|---|
| `status` | `'connected' \| 'connecting' \| 'disconnected' \| 'error'` | Connection state from `DisconnectedBannerProps` |
| `onReconnect` | `() => void` | Manual retry handler |

**Accessibility:** Connecting state uses `<output aria-live="polite">` so the pill is announced without being a focus trap. Error/disconnected state uses `role="alert"` for an assertive announcement.

**Appears in:** `InvestigationLiveFeed` (via the SSE plumbing in `incident-stream-types`).

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/disconnected-banner.tsx`

---

## InvestigationModeSelector

Staff-only dropdown + "Run" button for launching an investigation under an explicit reasoning mode. Composed from the `Select` primitive (`@causeflow/ui/primitives`). Modes: `orchestrator`, `hypothesis`, `debate`. Each `<SelectItem>` shows a two-line label (title + muted description).

| Prop | Type | Description |
|---|---|---|
| `onRun` | `(mode: InvestigationModeName) => void` | Fires on Run click |
| `isRunning` | `boolean` | Disables Select and Run; swaps spinner into button |

**Accessibility:** The `Select` primitive handles listbox semantics. Button has explicit `type="button"`; spinner is `aria-hidden`. Staff gating is done by the parent (`useIsStaff()` in `IncidentActionBar`) — the component itself does not enforce role.

**Appears in:** `incident-action-bar.tsx:88-92` (gated by `isStaff` in the `open` status branch).

**Source:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/investigation-mode-selector.tsx`

---

## Notes

- All components in this family are `'use client'` — they rely on `useTranslations`, local UI state, or both.
- Translation namespace for this cluster: `dashboard.incidents.detail.*` (see `apps/dashboard/src/contexts/investigation/infrastructure/i18n/`).
- The parent `IncidentDetail` owns all fetch state (`fetchIncident`) and WS plumbing (`InvestigationLiveFeed.onStatusChange` / `onConnectionChange` / `onHypothesisProgress`). Children are intentionally pure so tests can drive them with simple prop snapshots.
