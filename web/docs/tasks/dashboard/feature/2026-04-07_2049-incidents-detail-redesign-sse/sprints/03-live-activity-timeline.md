# Sprint 3: Live Activity Timeline Component

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 3 of 5
- **Depends on:** Sprint 1 (SSE hook + types) AND Sprint 2 (audit BFF)
- **Batch:** 2 (parallel with Sprint 4)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Build the `<LiveActivityTimeline>` component that fetches the initial audit history (via the new BFF parameters from Sprint 2), then appends new events from the SSE stream (via the hook from Sprint 1). Renders one card per agent step with a per-agent role icon, with a deduplication pass on `entryId` / synthetic event keys.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/live-activity-timeline.tsx` — the timeline component itself.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/agent-step-card.tsx` — pure presentational card for one timeline entry.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/lib/agent-step-mappers.ts` — pure helpers `mapAuditEntryToAgentStep` and `mapSseEventToAgentStep` (so they can be unit-tested in isolation).
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/lib/agent-role-meta.ts` — icon + color + i18n key map for each `AgentRole` value.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/live-activity-timeline.test.tsx` — RTL tests.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/agent-step-card.test.tsx` — RTL tests.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__/agent-step-mappers.test.ts` — pure-function tests for the mappers.

### Modifies (can touch)

- NONE. This sprint creates new files only. No existing files are modified.

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/contexts/investigation/domain/incident-stream-types.ts` (Sprint 1) — for `UseIncidentStreamResult`, `IncidentStreamEvent`, `AGENT_ROLES`, `AgentRole`.
- `apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-stream.ts` (Sprint 1) — for type reference; the consumer here will be Sprint 5.
- `apps/dashboard/src/contexts/audit/domain/types.ts` (Sprint 2) — for `AuditEntry`, `ALLOWED_AUDIT_RESOURCE_TYPES`, `VALID_ACTIONS`.
- `apps/dashboard/src/lib/api/core-api-types.ts` (Sprint 2) — for `ListAuditParams`.

### Shared Contracts (consume from prior sprints or PRD)

- `UseIncidentStreamResult` from Sprint 1 — `<LiveActivityTimeline>` accepts a `stream` prop of this type.
- `AGENT_ROLES`, `AgentRole` from Sprint 1.
- `AuditEntry` from `audit/domain/types.ts`.
- `ALLOWED_AUDIT_RESOURCE_TYPES` from Sprint 2.

### Consumed Invariants (from INVARIANTS.md)

- `Agent roles are an exhaustive enum` — the icon map MUST cover every value in `AGENT_ROLES`.
- `Loading... literal banned` — use a skeleton component, not the literal string.
- `No barrel imports` — direct deep paths only.

## Tasks

- [x] Create `lib/agent-role-meta.ts`:
  - Export `AGENT_ROLE_META: Record<AgentRole, { icon: LucideIcon; colorClasses: string; labelKey: string }>`.
  - Use lucide icons: `orchestrator` -> `Workflow`, `log_analyst` -> `FileText`, `metric_analyst` -> `LineChart`, `infra_inspector` -> `Server`, `scout` -> `Search`, `diagnosis_verifier` -> `CheckCircle`.
  - `colorClasses` are Tailwind class strings using design tokens (e.g. `'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950 dark:border-blue-800'`).
  - `labelKey` is an i18n key like `'dashboard.incidents.detail.agents.log_analyst'`. The keys themselves are added in Sprint 5.
- [x] Create `lib/agent-step-mappers.ts`:
  - Define an internal `AgentStep` type: `{ id: string; agentRole: AgentRole | null; action: string; summary?: string; createdAt: string; actorType: 'agent' | 'system' | 'user'; status?: 'running' | 'completed' | 'failed' }`.
  - `mapAuditEntryToAgentStep(entry: AuditEntry): AgentStep | null` — extracts `agentRole` from the action prefix (e.g. `agent.log_analyst.started` -> `'log_analyst'`). Returns null if the entry is not relevant (e.g. `actorType !== 'agent'` AND not in a fixed allowlist of investigation actions).
  - `mapSseEventToAgentStep(event: IncidentStreamEvent): AgentStep | null` — same logic but for SSE event payloads. The synthetic id should be a stable hash of `event.event + event.data.id || event.receivedAt`.
- [x] Create `agent-step-card.tsx`:
  - Props: `{ step: AgentStep }`.
  - Renders an icon (from the meta map), the translated label, the action verb, the formatted relative time, and the optional summary.
  - When `agentRole === null`, falls back to a generic "System" icon and label.
  - Uses `formatRelativeTime` from `@/contexts/shared/lib/format-date`.
- [x] Create `live-activity-timeline.tsx`:
  - Props: `{ incidentId: string; stream: UseIncidentStreamResult }`.
  - On mount, fetches `/api/audit?resourceType=incident&resourceId=${incidentId}&limit=50`.
  - Maps the response through `mapAuditEntryToAgentStep`, filters out nulls.
  - Stores the resulting array in state.
  - In a `useEffect`, calls `stream.on('audit.appended', handler)` and similar event types — the handler maps via `mapSseEventToAgentStep` and prepends to state if the synthetic id is not already present (dedup).
  - Sorts by `createdAt DESC` defensively (Open Question 4 in PRD).
  - Renders states:
    - `loading` — three skeleton cards.
    - `error` — error card with Retry button (re-fetches).
    - `empty` — `<p class="text-muted-foreground">{t('liveActivity.empty')}</p>`.
    - `populated` — vertical list of `<AgentStepCard>`.
  - Uses `aria-live="polite"` and `aria-atomic="false"` so screen readers announce new entries.
- [x] Write tests:
  - `agent-step-mappers.test.ts`: maps for each agent role; returns null for non-agent entries; synthetic id stability.
  - `agent-step-card.test.tsx`: renders icon for each role; falls back to generic when role is null; renders relative time.
  - `live-activity-timeline.test.tsx`:
    - Renders skeleton on mount before fetch resolves.
    - After fetch resolves with 0 entries, shows empty state.
    - After fetch resolves with 3 entries, renders 3 cards.
    - Simulates an SSE event (mock stream prop) and asserts a new card appears.
    - Same incident.entryId twice -> dedups to a single card.
    - Fetch error -> renders error state with Retry button.

## Acceptance Criteria

- [x] `<LiveActivityTimeline>` renders all four states (loading / error / empty / populated).
- [x] Agent role icons render correctly for all six roles defined in `AGENT_ROLES`.
- [x] SSE events trigger appended timeline entries within React's normal render cycle (no setTimeout / no manual rerender hacks).
- [x] Duplicate events (same `entryId`) do not render twice.
- [x] Component is keyboard-accessible and uses `aria-live="polite"`.
- [x] All new tests pass.
- [x] No literal `"Loading..."` strings.

## Verification

- [x] `pnpm exec biome check apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/`
- [x] `pnpm vitest run apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/__tests__`
- [x] `pnpm turbo check-types --filter=dashboard`

> **Note:** Dev server smoke test and content verification are handled by the orchestrator after merge — do not run in the sprint-executor. Sprint-executors do static verification only.

## Context

- This sprint creates new files only — it does NOT modify `incident-detail.tsx`. The actual integration into the page happens in Sprint 5.
- The audit endpoint may return entries in either `createdAt ASC` or `DESC` order — the OpenAPI spec is silent. Sort defensively in the component.
- For the SSE event names: based on the upstream Notification model, expected SSE event types are roughly `incident.status_changed`, `notification.created`, and possibly `audit.appended`. If the upstream does NOT emit `audit.appended` today, the timeline will only show events appended via the audit history fetch. Document this fallback in agent notes.
- Test files use `.test.tsx` (with React Testing Library) for component tests and `.test.ts` for pure-function tests.
- The `formatRelativeTime` helper is at `apps/dashboard/src/contexts/shared/lib/format-date.ts` — direct deep import.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]
