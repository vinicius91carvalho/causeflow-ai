# Sprint 1: SSE Hook + Bug Fixes

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 1 of 5
- **Depends on:** None
- **Batch:** 1 (parallel with Sprint 2)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Ship the new `useIncidentStream` hook, kill the 5-second polling in `incident-detail.tsx`, and fix the perma-`Loading...` bug in the feedback and remediations sections. This sprint alone is independently shippable as a user-visible bug fix and a measurable performance win.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/investigation/domain/incident-stream-types.ts` — type definitions for the SSE hook contract.
- `apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-stream.ts` — the React hook that opens an `EventSource` against `/api/notifications/stream` and exposes filtered events for one incident.
- `apps/dashboard/src/contexts/investigation/presentation/hooks/__tests__/use-incident-stream.test.ts` — unit tests for the hook (connect, receive matching event, filter non-matching, disconnect, reconnect).
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/disconnected-banner.tsx` — small banner that renders when `IncidentStreamStatus !== 'connected'`. Has a Retry button.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/disconnected-banner.test.tsx` — unit test rendering each status state.

### Modifies (can touch)

- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` — remove `setInterval` / `POLL_INTERVAL_MS` / `IN_PROGRESS_STATUSES` polling logic. Integrate `useIncidentStream`. Re-fetch the incident only when an SSE event tells us the status transitioned.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-feedback.tsx` — fix the `if (!res.ok) return;` early-return bug; replace stuck `Loading...` with explicit error/empty UI branches.
- `apps/dashboard/src/contexts/investigation/presentation/components/remediations-section.tsx` — same bug fix as above. (Note: this sprint only adds the `error` state. Sprint 4 adds the `pending`/`completed-empty` distinction.)
- `apps/dashboard/src/contexts/investigation/presentation/components/__tests__/polling.test.ts` — invert assertions. Rename the suite to "Polling regression — must NOT poll". Assert via source-file inspection (read the file and assert the literal does not contain `setInterval` or `POLL_INTERVAL_MS`).

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/contexts/shared/api/notifications-stream-handler.ts` — existing SSE proxy. Reference for the event format we are consuming.
- `apps/dashboard/src/contexts/investigation/domain/types.ts` — `Incident`, `IncidentStatus` definitions.
- `apps/dashboard/src/contexts/investigation/infrastructure/i18n/{en,pt-br}.json` — read for existing keys; new keys are added in Sprint 4 and Sprint 5.

### Shared Contracts (consume from prior sprints or PRD)

- This sprint **defines** the shared contracts in PRD Section 12 — `IncidentStreamEvent`, `UseIncidentStreamResult`, `AGENT_ROLES`, `IncidentStreamStatus`, `DisconnectedBannerProps`. All of them live in the new `domain/incident-stream-types.ts` file.

### Consumed Invariants (from INVARIANTS.md)

- `Polling forbidden in incident-detail` — this sprint creates the conditions; the verify command must pass after this sprint completes.
- `Loading... literal banned` — this sprint removes the literal from the two affected files.
- `Tenant isolation` — the hook MUST filter by `incidentId` before exposing events.
- `No barrel imports` — all imports use direct deep paths.

## Tasks

- [x] Create `domain/incident-stream-types.ts` with `IncidentStreamStatus`, `IncidentStreamEvent`, `UseIncidentStreamResult`, `AGENT_ROLES`, `AgentRole`, and `DisconnectedBannerProps` exactly as defined in PRD Section 12.
- [x] Create `presentation/hooks/use-incident-stream.ts`:
  - Accepts `(incidentId: string)`.
  - In a `useEffect`, opens `new EventSource('/api/notifications/stream')`. Guards SSR with `typeof window === 'undefined'`.
  - On `message` and named events, parses the payload, checks `data.incidentId === incidentId`, and dispatches to subscribed handlers.
  - Maintains internal `Map<eventType, Set<handler>>` for `on(eventType, handler)` subscription.
  - Tracks `status` via `onopen` / `onerror`.
  - `reconnect()` closes the existing source and creates a new one.
  - Cleans up on unmount.
- [x] Create `presentation/components/incident-detail/disconnected-banner.tsx`:
  - Props: `{ status: IncidentStreamStatus; onReconnect: () => void }`.
  - Renders nothing when `status === 'connected'`.
  - Renders an amber banner with copy and a Retry button otherwise.
  - Uses `useTranslations('dashboard.incidents.detail.stream')` — i18n keys to be added later by Sprint 5.
- [x] Refactor `incident-detail.tsx`:
  - Delete `IN_PROGRESS_STATUSES`, `POLL_INTERVAL_MS`, and the polling `useEffect`.
  - Call `const stream = useIncidentStream(incident.incidentId)`.
  - Subscribe in a `useEffect`: `stream.on('incident.status_changed', () => fetchIncident())` (re-uses the existing fetch). Also subscribe to `incident.updated`, `investigation.completed`, `remediation.proposed` and re-fetch on those.
  - Render `<DisconnectedBanner status={stream.status} onReconnect={stream.reconnect} />` near the top.
  - Keep `fetchIncident` (the function), but only call it from SSE handlers — never from a timer.
- [x] Fix `incident-feedback.tsx`:
  - Add `const [error, setError] = useState<string | null>(null);`.
  - Change the `if (!res.ok) return;` branch to `setError('failed_load'); setFeedback([]);`.
  - In the render, branch: `if (feedback === null && !error) return <Skeleton />;` `if (error) return <ErrorCard onRetry={fetchFeedback} />;` `if (feedback?.length === 0) return <p>{t('empty')}</p>;` else render the existing list.
  - Replace the literal `Loading...` text with a `<Skeleton />` (use the existing one from `@/contexts/shared` or `packages/ui` if available; otherwise a simple animated div). Document if no shared skeleton exists; Sprint 4 will introduce one.
- [x] Fix `remediations-section.tsx` the same way: add `error` state, replace early-return-on-error, replace literal `Loading...`. Do NOT add the `pending` vs `completed-empty` distinction yet — that's Sprint 4. For now treat both as the existing empty state.
- [x] Invert `polling.test.ts`:
  - Rename the file's `describe` block to `Polling regression — must NOT poll`.
  - Replace existing tests that asserted polling worked with: read the source of `incident-detail.tsx` via `fs.readFileSync` (or import as a string with Vite raw import), assert it does NOT contain `setInterval` or `POLL_INTERVAL_MS` or `IN_PROGRESS_STATUSES`.
- [x] Write tests for `useIncidentStream`:
  - Mocks `EventSource` (use `@vitest/browser` mock or a hand-rolled class).
  - Test 1: hook opens EventSource on mount.
  - Test 2: receives an event with matching `incidentId` and dispatches to subscribed handler.
  - Test 3: receives an event with non-matching `incidentId` and does NOT dispatch.
  - Test 4: closes EventSource on unmount.
  - Test 5: `reconnect()` closes and reopens EventSource.
  - Test 6: status transitions `connecting -> connected -> error` are reflected.
- [x] Write a test for `<DisconnectedBanner>`:
  - Renders nothing when `status === 'connected'`.
  - Renders an alert and Retry button when `status === 'disconnected'` or `'error'`.
  - Calling Retry invokes `onReconnect`.

## Acceptance Criteria

- [x] `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` does not contain the strings `setInterval`, `POLL_INTERVAL_MS`, or `IN_PROGRESS_STATUSES` (verified by a test that reads the source).
- [x] `useIncidentStream` opens an `EventSource` against `/api/notifications/stream` on mount and closes it on unmount.
- [x] `useIncidentStream` filters events by `incidentId` — events for other incidents are ignored.
- [x] When the stream errors, `<DisconnectedBanner>` renders with a Retry button. Clicking Retry calls `stream.reconnect()`.
- [x] When `GET /api/incidents/{id}/feedback` returns `!res.ok`, the Feedback section shows an explicit error state (NOT `Loading...`).
- [x] When `GET /api/remediations?incidentId=...` returns `!res.ok`, the Remediations section shows an explicit error state (NOT `Loading...`).
- [x] No literal `"Loading..."` strings remain in `incident-feedback.tsx` or `remediations-section.tsx`.
- [x] All new tests pass. All existing tests in `apps/dashboard/src/contexts/investigation/presentation/components/__tests__/` still pass.

## Verification

- [x] `pnpm exec biome check apps/dashboard/src/contexts/investigation/`
- [x] `pnpm vitest run apps/dashboard/src/contexts/investigation`
- [x] `pnpm turbo check-types --filter=dashboard`
- [x] Invariant grep checks pass (run by `check-invariants.sh` PostToolUse hook on each save):
  - `! grep -E 'setInterval|POLL_INTERVAL_MS' apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx`
  - `! grep '"Loading..."' apps/dashboard/src/contexts/investigation/presentation/components/incident-feedback.tsx`
  - `! grep '"Loading..."' apps/dashboard/src/contexts/investigation/presentation/components/remediations-section.tsx`

> **Note:** Dev server smoke test and content verification are handled by the orchestrator after merge — do not run in the sprint-executor. Sprint-executors do static verification only.

## Context

- The current polling logic is at `incident-detail.tsx` lines 24-25 (constants) and 38-61 (the `fetchIncident` callback + the `useEffect` that schedules `setInterval`).
- The two stuck-Loading bugs are at `incident-feedback.tsx` line 180 (the `if (!res.ok) return;` in `fetchFeedback`) and `remediations-section.tsx` line ~252 (similar early return). The render-side `Loading...` strings are at line 303 and 284 respectively.
- The existing SSE proxy at `apps/dashboard/src/contexts/shared/api/notifications-stream-handler.ts` returns events in the standard SSE format (`event: name\ndata: {...}\n\n`). The browser `EventSource` will parse these automatically and dispatch them either as `message` (default) or as named events when `addEventListener('event-name', ...)` is used.
- For the `incidentId` filter: backend events should include `incidentId` in their `data` payload (e.g. `data: { "incidentId": "...", "status": "investigating" }`). Defensive code: if `data.incidentId` is missing AND the event type is one of the global types like `notification.created`, fall through to a re-fetch as a safety net.
- `eventsource-mock` may or may not exist in node_modules. If unavailable, hand-roll a minimal mock class with `addEventListener`, `dispatchEvent`, `close`, and `onopen/onerror/onmessage` properties. Document the choice in agent notes.
- Lines of code budget for `incident-detail.tsx` after this sprint: still likely > 250 (full refactor is Sprint 5). Just remove polling for now; do not rewrite the layout.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
