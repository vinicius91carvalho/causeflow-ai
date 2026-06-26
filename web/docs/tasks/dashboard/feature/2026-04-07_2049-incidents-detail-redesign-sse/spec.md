# Incident Detail Page: Redesign + SSE + Live Audit Trail

## 1. What & Why

**Problem:** The incident detail page (`/dashboard/incidents/[id]`) is the most-used screen in the product, but it has five concrete problems:

1. **Wasteful polling.** It re-fetches `GET /api/analyses/{id}` every 5 seconds via `setInterval` while status is `open|triaging|investigating`. The backend already exposes `GET /v1/notifications/stream` (SSE) and a proxy handler exists at `/api/notifications/stream`, yet the screen ignores it.
2. **Invisible agent work.** Operators see only a status badge while the multi-agent investigation runs. They cannot see *what each agent is doing*, *what evidence has been collected*, or *what step the investigation is on*. The Audit endpoint (`GET /v1/audit`) records every step but nothing on this screen reads it.
3. **Lying empty state.** When the investigation finishes with **zero** remediations, the Remediations section still says *"no remediations proposed yet"* — implying *more might come*. The state is indistinguishable from "investigation still running, just hasn't proposed yet". This destroys trust.
4. **Permanently broken Feedback section.** `incident-feedback.tsx` shows `Loading...` and never recovers when the GET fails non-OK. The state stays `null` because the early-return on `!res.ok` never sets `[]`. Same bug latent in `remediations-section.tsx`.
5. **Flat, undifferentiated layout.** Eight stacked sections in a 768px column with no visual hierarchy. Status, root cause, live activity, remediations, and feedback all compete for the same horizontal space and scroll depth.

**Desired Outcome:** A redesigned incident detail page where:

- Operators can watch the investigation happen **live** — agent-by-agent, step-by-step — via a single SSE connection (no polling).
- The information hierarchy reflects the operator's actual workflow: *what's happening right now → root cause → what to do about it → record what you learned*.
- Empty / failure / completed-with-zero states are explicit, distinct, and trustworthy.
- The page is the visual reference for the rest of the dashboard — beautiful, dense without being noisy, and built mobile-first.

**Justification:** This is the screen the user will use most. Polling at 5s/incident wastes CORE-API quota and DynamoDB read units, and gives a stale-feeling UX (5s lag). Showing the live agent steps transforms the product from a black box ("the AI did its thing") into a glass box ("here is exactly what each agent investigated and what it found"), which is the key competitive differentiator vs. resolve.ai / Rootly. Also, the "no remediations proposed yet" lie and the perma-Loading bug are user-visible quality regressions that erode trust on every visit.

## 2. Correctness Contract

**Audience:** SRE / on-call engineer at a 2-50 engineer company. They land here after either (a) a webhook-triggered alert, (b) clicking a notification, or (c) creating an incident manually. They need to make one of three decisions: *(i) approve a remediation*, *(ii) abort the investigation and take over manually*, *(iii) close the incident as resolved with feedback*.

**Failure Definition:** The page is useless if:
- Operators cannot tell at a glance **what state the investigation is in** (running / done / failed / no remediations).
- Live updates lag the backend by more than 2 seconds (current polling is ~5s).
- The "agent step" timeline is fake/cosmetic — i.e. it shows fixed steps regardless of what the backend actually did.
- The screen burns API quota by polling when SSE is available.

**Danger Definition:** The page is *actively harmful* if:
- It silently swallows backend errors and keeps showing "Loading..." indefinitely (current bug).
- It claims "no remediations proposed yet" when the investigation has finished and there will be no more remediations (current bug — this can cause an operator to wait forever).
- It shows agent steps from a different incident (cross-tenant or cross-incident SSE leak).
- It auto-approves a remediation because of a stale event ordering bug.

**Risk Tolerance:** **Refusal preferred over confident-wrong.** If we cannot determine the investigation status, show an explicit error / retry — never default to a "looks fine" state. If the SSE stream drops, fall back to a manual "Reconnect" button, **not** silent re-polling at 5s.

## 3. Context Loaded

- **Core API SSE endpoint:** `GET /v1/notifications/stream` — SSE stream of notifications for the tenant. Already proxied by `apps/dashboard/src/contexts/shared/api/notifications-stream-handler.ts` (route at `/api/notifications/stream`). The handler uses a `ReadableStream` and sets `Content-Type: text/event-stream`. Source: `core/docs/openapi.yaml:892`, `core/docs/product/06-api-endpoints.md:257`.
- **Core API audit endpoint:** `GET /v1/audit` — paginated, supports filter by `action`. Returns `AuditEntry[]` with `actorType (user|system|agent)`, `action`, `resourceType`, `resourceId`, `changes`, `createdAt`. Already proxied at `/api/audit` via `apps/dashboard/src/contexts/audit/api/audit-handler.ts`. Source: `core/docs/openapi.yaml:469`, `core/docs/product/06-api-endpoints.md:159`.
- **Investigation result endpoint:** `GET /v1/investigation/{incidentId}` — returns `Investigation` with `status (pending|running|completed|aborted|failed)`, `rootCause`, `summary`, `evidenceByAgent`, `startedAt`, `completedAt`. Source: `core/docs/openapi.yaml:667`.
- **Evidence schema:** `Evidence { evidenceId, agentRole (log_analyst|metric_analyst|infra_inspector|orchestrator|scout|diagnosis_verifier), kind, summary, data, createdAt }`. Source: `core/docs/openapi.yaml:2192`.
- **AuditEntry schema (web side):** `apps/dashboard/src/contexts/audit/domain/types.ts` — `{ entryId, action, actorType, actorEmail, resourceType, resourceId, entryHash, createdAt }`. `VALID_ACTIONS` includes `incident.created`, `incident.status_changed`, `remediation.proposed`, `remediation.approved`, `remediation.rejected`, `remediation.executed`, `approval.responded`. We will likely need to extend this with `investigation.*` actions.
- **Current incident detail component:** `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx`. Lines 24-25, 38-61: the `IN_PROGRESS_STATUSES` set + `setInterval(fetchIncident, POLL_INTERVAL_MS)`. This is the polling that must die.
- **Current "Loading..." bug locations:**
  - `incident-feedback.tsx:303` — `feedback === null` branch shows `Loading...`. Fetch at line 177 returns early on `!res.ok` without setting `[]`, so a 500 from `/api/incidents/{id}/feedback` permanently sticks the section.
  - `remediations-section.tsx:284` — Same pattern with the literal `Loading...` and the same early-return-on-error bug.
- **Investigation BFF handlers:** All in `apps/dashboard/src/contexts/investigation/api/` — analyses-id-handler, analyses-investigate-handler, analyses-triage-handler, feedback-handler, remediations-handler, etc.
- **Frontend stack:** React 19, Next.js 15 App Router, Tailwind v4 + Shadcn/ui, lucide-react icons, next-intl, useToast pattern from `@/contexts/shared/presentation/components/toast-provider`.
- **Bounded context structure:** `apps/dashboard/CLAUDE.md` documents the DDD layers. Cross-context imports use direct deep paths (no barrels). Page-level i18n stays in the context's `infrastructure/i18n/`.
- **No barrel imports.** All imports use direct deep paths (`@/contexts/investigation/domain/types`, etc.) per project rules.
- **Current page route:** `apps/dashboard/src/contexts/investigation/presentation/pages/incident-detail-page.tsx` — server component, fetches via `getApiClient().getIncident(id)`, hands off to `<IncidentDetail initialIncident={...} />`.
- **i18n:** `apps/dashboard/src/contexts/investigation/infrastructure/i18n/{en,pt-br}.json` namespace `dashboard.incidents.detail`. We will add new keys for live activity, agent labels, and the new empty states.

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|---|---|---|---|
| GET requests to `/api/analyses/{id}` per minute (per active incident detail page) | ~12 (every 5s) | 0 (SSE, not polling) | Server logs + Vitest assertion that no `setInterval` exists in `incident-detail.tsx` |
| Time-to-update after backend status change | ~2.5s avg (polling phase) | <= 500ms p95 | E2E test: backend POST -> assert UI updates within timeout |
| Agent activity events visible to operator | 0 | All audit events with `actorType=agent` for this incident, in real time | Visible in `<LiveActivityTimeline>` component |
| "Loading..." stuck states | 2 (feedback + remediations) | 0 | Unit test: simulate fetch failure, assert error state renders, never `Loading...` |
| Distinct empty/error/completed-empty states for Remediations | 1 ("no remediations proposed yet") | 4 (loading / error / pending-during-run / explicitly-zero-after-completion) | Unit tests asserting each branch |
| Lines of code in `incident-detail.tsx` | 442 | < 250 (split into purpose-built sub-components) | `wc -l` after refactor |

## 5. User Stories

GIVEN I am an SRE on-call and a webhook just created an incident with status `triaging`
WHEN I open `/dashboard/incidents/{id}`
THEN I see (a) the headline status, (b) a live "Investigation In Progress" panel that streams agent activity in real time, (c) a clear primary CTA that depends on current state — without any 5-second-poll lag.

GIVEN the investigation is running and the orchestrator agent has just spawned the `log_analyst` agent
WHEN the backend records `audit.action="agent.started" actorType="agent"`
THEN within ~500ms my screen shows a new entry in the Live Activity Timeline: "Log Analyst started" with a spinner, agent role icon, and timestamp.

GIVEN the investigation has completed and produced **zero** remediations
WHEN I scroll to the Remediations section
THEN I see an explicit success-state card: *"Investigation complete. No remediations needed — root cause was X."* (NOT "no remediations proposed yet").

GIVEN the Feedback API returns 500
WHEN I view the page
THEN the Feedback section shows an explicit error state with a Retry button — never a stuck `Loading...`.

GIVEN I am on a phone (375px wide)
WHEN I open the incident detail page
THEN the layout collapses cleanly to a single column, sticky status bar at the top, all CTAs remain reachable, and the live activity timeline is scrollable in place.

GIVEN the SSE stream drops (network blip)
WHEN the connection is lost for > 5 seconds
THEN the page shows a small banner *"Live updates disconnected — reconnect"* with a Retry button. **No silent fall-back to polling.**

GIVEN I want to give feedback that the RCA is wrong
WHEN I click "Reject RCA"
THEN the feedback form expands inline, accepts my comment, submits via `POST /api/incidents/{id}/feedback`, and the new entry appears optimistically in the history list.

## 6. Acceptance Criteria

### Functional / behavioral

- [x] `incident-detail.tsx` has zero `setInterval` calls and zero references to `POLL_INTERVAL_MS`.
- [x] A new `useIncidentStream(incidentId)` hook subscribes to `/api/notifications/stream` via `EventSource`, filters events by `incidentId`, and exposes `{ status, lastEvent, isConnected, reconnect }`.
- [x] On every relevant SSE event for this incident, the component patches its local state (no full re-fetch unless the patch indicates a status transition that changes the layout).
- [x] On SSE disconnect, the page shows an explicit `<DisconnectedBanner>` with a Retry button. There is **no automatic 5-second poll fallback**.
- [x] A new `<LiveActivityTimeline>` component fetches `/api/audit?resourceType=incident&resourceId={id}` on mount, then appends new entries from the SSE stream as they arrive.
- [x] The BFF handler at `/api/audit` accepts and forwards `resourceType` and `resourceId` query parameters to the upstream `/v1/audit` call. Validation: only allowed `resourceType` values pass through.
- [x] Each agent role (log_analyst, metric_analyst, infra_inspector, orchestrator, scout, diagnosis_verifier) has a distinct icon + label + color in the timeline.
- [x] Remediations section has four distinct states with explicit copy and visual treatment:
  - `loading` — skeleton, never the literal string "Loading..."
  - `error` — error card with Retry button
  - `pending` (status `investigating`/`triaging`) — "Waiting for investigation to propose remediations..." with subtle spinner
  - `completed-empty` (status `resolved`/`closed` and zero remediations) — "Investigation complete — no remediations needed."
  - `populated` — current card layout
- [x] Same four states for the Feedback section (loading-skeleton / error / empty-after-load / populated).
- [x] **Bug fix:** the early-return on `!res.ok` in `incident-feedback.tsx` and `remediations-section.tsx` is replaced with explicit `setError(message)` + UI branch.
- [x] `incident-detail.tsx` body is < 250 lines and delegates to purpose-built sub-components.

### UX / layout

- [x] Mobile-first: the page renders correctly at 375px (no horizontal scroll, all CTAs reachable).
- [x] At >= 1024px: a 2-column layout — left column (8/12) for the narrative (description, root cause, resolution, remediations, feedback), right column (4/12) for the sticky status panel + live activity timeline.
- [x] Sticky status header (title, badges, primary CTA) on scroll at >= 768px.
- [x] All copy is in `infrastructure/i18n/{en,pt-br}.json` under `dashboard.incidents.detail`. New keys added in both locales.
- [x] No literal `Loading...` strings anywhere — they are replaced with `<Skeleton />` components or explicit translated keys.
- [x] Color, spacing, typography all use existing design tokens — no hard-coded hex values.

### Quality gates

- [x] All existing tests in `apps/dashboard/src/contexts/investigation/presentation/components/__tests__/` pass (or are updated with documented reasons).
- [x] New unit tests for the four-state branches in Remediations and Feedback (12+ test cases total).
- [x] New unit test for `useIncidentStream` covering: connect, receive event, filter by incidentId, disconnect, reconnect.
- [x] New integration test using `eventsource-mock` (or equivalent) that simulates a backend status transition and asserts UI update.
- [x] `pnpm turbo build` passes.
- [x] `pnpm exec biome check .` passes.
- [x] `pnpm turbo check-types` passes.
- [x] `pnpm vitest run apps/dashboard/src/contexts/investigation` passes.
- [x] Manual verification: dev server up, incident detail page loads without errors at 375px, 768px, 1024px, 1280px+.

## 7. Non-Goals (what we are NOT doing)

- **Not** redesigning the incident **list** page (`/dashboard/incidents`) — that is a separate task. This PRD is scoped to the **detail** page only.
- **Not** changing the backend SSE event schema or adding new SSE event types. We consume what `/v1/notifications/stream` already emits.
- **Not** removing the polling test file entirely — we will repurpose it as a regression test that asserts polling **is gone**.
- **Not** implementing a "reconnect with exponential backoff" auto-retry. We show a manual Retry button. (Rationale: silent retries hide upstream issues; explicit user action is debuggable.)
- **Not** building a new "global incident view" or topology visualization on this page.
- **Not** adding "subscribe to email updates" or any new notification channels.
- **Not** changing the Auth.js / Cognito / RBAC flow — this is presentation-layer only.
- **Not** touching the remediation execution flow — only the **display** of remediations and their explicit empty state.
- **Not** creating a separate Audit Trail page — the audit entries for this incident are surfaced inline via `<LiveActivityTimeline>`. A standalone `/dashboard/audit` page already exists.
- **Not** rewriting the legacy `Analysis` types — they stay deprecated and untouched.

## 8. Technical Constraints

- **Stack:** React 19, Next.js 15 App Router (SSR), TypeScript strict mode, Tailwind CSS v4, Shadcn/ui, lucide-react, next-intl, Vitest.
- **Architecture:** DDD bounded context — all changes inside `apps/dashboard/src/contexts/investigation/` and `apps/dashboard/src/contexts/audit/` with one tiny additional file in `lib/api/` for the EventSource type wrapper. Cross-context imports use direct deep paths (no barrels). Page-level i18n stays in the context's `infrastructure/i18n/`.
- **No Turbopack** (PRoot crashes — see root CLAUDE.md). Use Webpack `next dev` only.
- **No new dependencies.** EventSource is a browser global. If we need a polyfill for SSR-safe imports, use `eventsource` (already used by `notification-stream-handler` in shared context).
- **Mobile first.** Default styles target 375px; tablet/desktop via `md:`/`lg:`/`xl:` breakpoints.
- **Accessibility:** All interactive elements keyboard reachable. `aria-live="polite"` on the live activity timeline. Skeleton states use `aria-busy="true"`. Color contrast WCAG AA.
- **Performance:** Initial paint must not block on SSE connection. SSE connects after first paint via `useEffect`. No layout shift when SSE events arrive (use `min-h` on the live activity panel).
- **Bundle:** No code-splitting changes. The page must remain under the existing per-route JS budget.
- **Tenant isolation:** SSE events MUST be filtered to `incidentId` on the client; the backend is already tenant-scoped via the bearer token.
- **XSS-safe rendering:** All user / agent-emitted content is rendered through React's auto-escaping JSX. No raw HTML injection helpers anywhere in this feature.

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|---|---|---|---|
| Use the existing `/api/notifications/stream` SSE proxy as the live update transport for the incident detail page | Low | (a) Add a new `/api/incidents/{id}/stream` proxy specifically for this page; (b) keep polling | The existing handler already forwards arbitrary backend SSE events with their `event:` type intact. We just filter on the client by `incidentId`. Adding a per-incident endpoint would duplicate plumbing for marginal benefit. |
| Filter SSE events by `incidentId` on the **client** | Low | Filter on the BFF | The proxy is generic and used by other features (notification bell). Filtering server-side for one consumer would require either query params (duplicating connections) or breaking the shared proxy. Client-side filter is one `if`. |
| Manual reconnect UI (no auto-retry) | Low | Exponential backoff auto-reconnect | Silent retries hide bugs and burn API quota. A visible `<DisconnectedBanner>` makes failure obvious and gives the operator agency. |
| `<LiveActivityTimeline>` is a NEW component, not an extension of the existing `<AuditTimeline>` from the audit context | Medium | Extend the audit context's component | The audit page is general-purpose (all actions, all resources). The incident detail timeline is specialized (one resource, agent role icons, live insertion). Sharing would force generic abstractions on day 1 of a feature still being designed. |
| Add `resourceType` and `resourceId` query parameters to `/api/audit` BFF | Low | Use the existing `action` filter and post-filter on the client | Client-side filter would fetch and discard up to 100 records per page just to find this incident's. Backend filter is one parameter passthrough; the upstream `/v1/audit` already supports it. |
| Sub-components live in `presentation/components/incident-detail/` (new sub-folder) — `live-activity-timeline.tsx`, `incident-status-panel.tsx`, `incident-narrative.tsx`, `disconnected-banner.tsx`, `agent-step-card.tsx` | Low | Keep everything flat in `components/` | We already have 8+ files prefixed `incident-` in that folder. Grouping the new ones in a sub-folder makes the bounded-context structure self-documenting and prevents `incident-*` namespace collisions. |
| Use Shadcn `<Card>`, `<Skeleton>`, `<Badge>` primitives where they already exist in `packages/ui` rather than hand-rolling Tailwind containers | Low | Hand-rolled Tailwind only | Shadcn primitives already match the rest of the dashboard's design vocabulary. Hand-rolling would create visual drift. |
| Mark the legacy `polling.test.ts` as a regression test that asserts polling is removed (rather than deleting it) | Low | Delete it | The presence of a green test for "polling does not exist" is the cheapest possible regression guard against future re-introduction. |
| Sprint 1 ships the SSE hook + bug fixes alone (no UI redesign yet) and is independently shippable | Low | Ship the redesign + SSE in one sprint | Splitting lets us land the polling killer + bug fixes immediately even if the redesign needs another iteration. The bug fixes alone are user-visible wins. |

## 10. Security Boundaries

- **Auth model:** Same as today. The page is behind `/dashboard/*` which requires an Auth.js v5 session via Cognito (see `apps/dashboard/src/middleware.ts`). The SSE proxy and audit BFF use `withAuth()` HOC with rate limiting + RBAC.
- **Trust boundaries:** All SSE events come from `/api/notifications/stream`, which is itself a trusted server-side proxy that adds the bearer token. Client-side never holds a backend bearer token. The `incidentId` passed to the hook comes from the page route param (server-validated by `incident-detail-page.tsx` calling `getIncident(id)` first — invalid IDs `notFound()` before render).
- **Tenant isolation:** The Core API SSE stream is **tenant-scoped** at the upstream level (the bearer token resolves to one tenant). On the client we additionally filter by `incidentId` to make sure events from other incidents in the same tenant do not bleed into this page's state.
- **Data sensitivity:** No new PII. The audit entries contain `actorEmail` which is already classified as low-sensitivity team-internal data. No tokens, no credentials, no secrets in any payload we render.
- **XSS:** All fields rendered via React (auto-escaped). No raw HTML injection helpers. The `changes` JSON blob in audit entries is formatted via `<pre>` with React text rendering only.
- **CSRF:** Not applicable to GET requests. POSTs (feedback, abort) already go through `withAuth()` which validates the session cookie.
- **Rate limiting:** Existing per-user 60/min limit on the BFF stays. SSE connection counts toward the user's connection budget (one per page load).
- **Permission:** `VIEW_ANALYSES` is required to read this page (already enforced by `withAuth`). Members and admins both have it.

## 11. Data Model

No schema changes. We consume existing entities only.

**Access Patterns (read-only from this page):**

1. *On mount:* `GET /api/analyses/{id}` — already happens server-side in the page component. **Latency budget: < 300ms.**
2. *On mount:* `GET /api/audit?resourceType=incident&resourceId={id}&limit=50` — fetch existing audit entries for this incident. **Latency budget: < 500ms.**
3. *On mount + held open:* `GET /api/notifications/stream` — SSE long-lived. **No latency budget (push).**
4. *On mount:* `GET /api/remediations?incidentId={id}` — already exists. **Latency budget: < 300ms.**
5. *On mount:* `GET /api/incidents/{id}/feedback` — already exists. **Latency budget: < 300ms.**
6. *On user action:* `POST /api/analyses/{id}/triage`, `POST /api/analyses/{id}/investigate`, `POST /api/analyses/{id}/investigate {abort:true}`, `POST /api/incidents/{id}/feedback`, `POST /api/remediations/{id} {action: approve|reject|execute}` — already exist.

**Entities consumed (unchanged):** `Incident`, `Remediation`, `AuditEntry`, `FeedbackItem`, `Notification`. All defined in their respective bounded contexts.

**Schema justification:** Reading audit entries by `(resourceType=incident, resourceId=X)` matches an existing access pattern that the upstream `/v1/audit` endpoint already supports as filter params. No new index needed; this is a standard scan with WHERE clause from the API perspective.

## 12. Shared Contracts

These types/interfaces/components are referenced by multiple sprints and live in well-defined locations.

### Data types (consumed from `domain/`)

```typescript
// apps/dashboard/src/contexts/investigation/domain/types.ts (existing — DO NOT MODIFY)
export interface Incident { ... }
export interface Remediation { ... }
export type IncidentStatus = 'open' | 'triaging' | 'investigating' | 'awaiting_approval' | 'remediating' | 'resolved' | 'closed';

// apps/dashboard/src/contexts/audit/domain/types.ts (existing — Sprint 2 adds new VALID_ACTIONS)
export interface AuditEntry { ... }
```

### New shared types (created in Sprint 1, consumed by Sprints 2-4)

```typescript
// apps/dashboard/src/contexts/investigation/domain/incident-stream-types.ts (NEW — Sprint 1)

/** Connection status of the live SSE stream. */
export type IncidentStreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** A single event from the SSE stream after parsing. */
export interface IncidentStreamEvent {
  /** SSE event name (e.g. "incident.status_changed", "audit.appended", "remediation.proposed") */
  event: string;
  /** Parsed JSON payload */
  data: Record<string, unknown>;
  /** Server-emitted timestamp if present, else client receive time */
  receivedAt: string;
}

/** Hook return shape — Sprint 2/3 components consume this. */
export interface UseIncidentStreamResult {
  status: IncidentStreamStatus;
  lastEvent: IncidentStreamEvent | null;
  /** Subscribe to a specific event type. Returns unsubscribe fn. */
  on: (eventType: string, handler: (event: IncidentStreamEvent) => void) => () => void;
  reconnect: () => void;
}

/** Agent role enum mirrors the upstream Evidence schema (core/openapi.yaml:2198). */
export const AGENT_ROLES = [
  'log_analyst',
  'metric_analyst',
  'infra_inspector',
  'orchestrator',
  'scout',
  'diagnosis_verifier',
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];
```

### New BFF query parameters (Sprint 2)

`GET /api/audit` accepts in addition to existing params:
- `resourceType?: string` (allowlist: `incident`, `remediation`, `approval`)
- `resourceId?: string` (passed through; backend validates)

### Component prop contracts (defined in Sprint 1, consumed in Sprints 3-4)

```typescript
// <LiveActivityTimeline> — Sprint 3
interface LiveActivityTimelineProps {
  incidentId: string;
  /** From useIncidentStream — Sprint 3 wires this in */
  stream: UseIncidentStreamResult;
}

// <RemediationsSection> — Sprint 4 (modifies existing component)
interface RemediationsSectionProps {
  incidentId: string;
  /** NEW: pass incident.status so the section can show "completed-empty" vs "pending" */
  incidentStatus: IncidentStatus;
  autoApprove?: boolean;
}

// <DisconnectedBanner> — Sprint 1 (used by Sprint 5 layout)
interface DisconnectedBannerProps {
  status: IncidentStreamStatus;
  onReconnect: () => void;
}
```

### Layout structure (Sprint 5)

```
mobile (< 768px):
  +-- sticky status header --+
  |  description             |
  |  live activity           |
  |  root cause              |
  |  remediations            |
  +- feedback ---------------+

desktop (>= 1024px):
  +-- sticky status header (full width) -------------------+
  +------ 8 cols ---------------+--- 4 cols (sticky) ------+
  |  description                |  status panel            |
  |  root cause                 |  live activity timeline  |
  |  remediations               |                          |
  |  feedback                   |                          |
  +-----------------------------+--------------------------+
```

### Design tokens (existing — referenced, not created)

- Colors: `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, severity colors via existing `<StatusBadge>` / `<SeverityBadge>` / `<RemediationStatusBadge>`.
- Spacing: Tailwind default scale.
- Typography: existing `text-xs / text-sm / text-base / text-xl` scale.

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
|---|---|---|---|
| Polling forbidden in incident-detail | investigation context | No `setInterval` and no `POLL_INTERVAL_MS` constant in `incident-detail.tsx` | `! grep -E 'setInterval\|POLL_INTERVAL_MS' apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` |
| Agent roles are an exhaustive enum | investigation context | `AGENT_ROLES` constant in `domain/incident-stream-types.ts` matches `core/docs/openapi.yaml` Evidence.agentRole enum | `grep "AGENT_ROLES" apps/dashboard/src/contexts/investigation/domain/incident-stream-types.ts` |
| SSE proxy stays generic | shared context | `notifications-stream-handler.ts` does NOT import any investigation types | `! grep "@/contexts/investigation" apps/dashboard/src/contexts/shared/api/notifications-stream-handler.ts` |
| `Loading...` literal banned | investigation context | The literal string `"Loading..."` does not appear in any incident-detail or feedback or remediations component | `! grep -r '"Loading..."' apps/dashboard/src/contexts/investigation/presentation/components/` |
| BFF audit param allowlist | audit context | `resourceType` query param only accepts `incident\|remediation\|approval` | `grep "ALLOWED_RESOURCE_TYPES" apps/dashboard/src/contexts/audit/api/audit-handler.ts` |
| No barrel imports | both contexts | No imports from `@/contexts/investigation/index` or `@/contexts/audit/index` | `! grep -rE "from '@/contexts/(investigation\|audit)';" apps/dashboard/src/` |
| Tenant isolation | investigation context | The `useIncidentStream` hook filters by `incidentId` before exposing events | `grep "incidentId" apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-stream.ts` |

**Dependency direction:** The `investigation` context owns `IncidentStreamEvent`, `UseIncidentStreamResult`, `AGENT_ROLES`, and the polling-banned invariant. The `audit` context owns the `AuditEntry` shape and the `resourceType` allowlist. The `shared` context owns the SSE proxy and must remain generic — it does NOT consume any investigation types. Cross-context contracts flow inward only.

## 14. Open Questions

- [x] **Q1:** Does the upstream Core API actually emit per-agent step events (e.g. `agent.started`, `agent.evidence_appended`, `agent.completed`) on the SSE stream today, or only top-level `incident.status_changed` and `notification.created`? If the former, we render rich live steps. If the latter, the live timeline falls back to audit entries with a 1-2s polling stagger via the audit endpoint, and we file an upstream task. **Owner:** @backend
- [x] **Q2:** Should the "no remediations needed" copy mention the root cause inline, or just say "no remediations needed" generically? Inline is more useful but creates a tighter coupling between the remediations card and the incident object. **Recommendation:** inline. **Owner:** @design
- [x] **Q3:** When the SSE stream is in `disconnected` state, do we still allow the Approve/Reject/Execute buttons on remediations to be clicked? Risk: stale state. Recommendation: yes, but show a tooltip "live updates paused — refresh to confirm". **Owner:** @product
- [x] **Q4:** Does the audit endpoint return entries in `createdAt DESC` order by default? The OpenAPI spec does not say. If ASC, the timeline must reverse before rendering. **Owner:** @backend (verify), Sprint 3 will handle defensively.

## 15. Uncertainty Policy

When uncertain about backend SSE event shapes: **assume the smallest contract** (status changes only) and degrade gracefully. Render a placeholder agent step "Investigation running" rather than guessing structured data.

When CORE_API_URL is unset (local dev / mock mode): **the SSE hook MUST gracefully no-op** and the page works with the initial SSR data. No console errors. The `<DisconnectedBanner>` shows "Live updates not available in dev" copy.

When the audit endpoint returns 500 or empty: **the live activity timeline shows only the events received from the SSE stream from this point forward**, with a small subtle "history unavailable" footnote. Never block the rest of the page.

When the SSE stream times out (5min server-side close): **automatically reopen one time silently**. If the second attempt also fails, switch to manual `<DisconnectedBanner>`.

When `incident.status` conflicts with the latest SSE event (e.g. SSR rendered `investigating` but the stream says `resolved`): **the SSE event wins** — patch state.

## 16. Verification

### Deterministic (run by sprint-executor)

- `pnpm exec biome check apps/dashboard/src/contexts/investigation/`
- `pnpm exec biome check apps/dashboard/src/contexts/audit/`
- `pnpm turbo check-types --filter=dashboard`
- `pnpm vitest run apps/dashboard/src/contexts/investigation`
- `pnpm vitest run apps/dashboard/src/contexts/audit`
- `pnpm turbo build --filter=dashboard`
- Invariant grep checks per Section 13 (run by `check-invariants.sh` PostToolUse hook).

### Manual (run by orchestrator after merge)

- Start dev server: `pkill -f "next-server|next start|next dev" 2>/dev/null; pnpm --filter dashboard dev`
- Open `http://localhost:3001/dashboard/incidents/{any-id}` in three browsers at viewports 375 / 768 / 1024 / 1280.
- Network tab: confirm zero `GET /api/analyses/{id}` requests after the initial page load. Confirm `EventSource` to `/api/notifications/stream` is open.
- DevTools: simulate offline -> confirm `<DisconnectedBanner>` appears within 5s, no console errors.
- Re-online -> click Reconnect -> confirm stream resumes.
- Visual review at all breakpoints. No horizontal scroll. CTAs reachable.
- Force a feedback API failure by stopping CORE_API mock -> confirm Feedback section shows error, NOT `Loading...`.

### Goodhart-resistance

- Test `polling.test.ts` is **inverted** — it asserts that no `setInterval` exists. A passing test = polling is gone. (Old test asserted polling started; we keep the file, swap the assertions, and change the suite name.)
- An e2e-style test simulates an SSE event and asserts state changes. This validates *behavior*, not just *output structure*.

## 17. Sprint Decomposition

Five sprints. Each shippable in isolation. Parallelism is intentional and constrained by file boundaries.

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|---|---|---|---|---|---|
| 1 | SSE hook + types + bug fixes | None | 1 | sonnet | Sprint 2 |
| 2 | Audit BFF passthrough + investigation actions registry | None | 1 | sonnet | Sprint 1 |
| 3 | Live Activity Timeline component | Sprint 1, 2 | 2 | sonnet | Sprint 4 |
| 4 | Remediations + Feedback four-state UX | Sprint 1 | 2 | sonnet | Sprint 3 |
| 5 | Layout redesign + integration + i18n | Sprint 3, 4 | 3 | sonnet | — |

> Sprint specs live in `sprints/01-...md` through `sprints/05-...md` and contain full file-boundary lists, tasks, and acceptance criteria.

## 18. Execution Log

[Filled during execution — tracked in progress.json]

## 19. Learnings (filled after all sprints complete)

[Compound step output]
