# INVARIANTS — Incident Detail Redesign

These cross-cutting contracts MUST hold across all sprints in this PRD. Each is machine-verifiable. The `check-invariants.sh` PostToolUse hook walks up from any edited file and runs the matching `Verify` commands.

## Polling Forbidden in Incident Detail

- **Owner:** investigation context (Sprint 1 establishes; Sprint 5 must preserve)
- **Preconditions:** Consumers of incident state must subscribe via `useIncidentStream`, not `setInterval`.
- **Postconditions:** `incident-detail.tsx` re-fetches the incident only on SSE event handlers (or user action).
- **Invariants:** No `setInterval`, no `POLL_INTERVAL_MS`, no `IN_PROGRESS_STATUSES` constant in `incident-detail.tsx`.
- **Verify:** `! grep -E 'setInterval|POLL_INTERVAL_MS|IN_PROGRESS_STATUSES' apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx`
- **Fix:** Replace any reintroduced timer with a `stream.on(...)` subscription. Read the Sprint 1 spec for the established pattern.

## Loading... Literal Banned

- **Owner:** investigation context (Sprint 1 removes; Sprints 3, 4, 5 must not reintroduce)
- **Preconditions:** Components must use `<Skeleton />` (or an explicit translated key) for loading states.
- **Postconditions:** No literal `"Loading..."` substring in any incident-detail / feedback / remediations component.
- **Invariants:** Zero matches across `apps/dashboard/src/contexts/investigation/presentation/`.
- **Verify:** `! grep -r '"Loading\.\.\."' apps/dashboard/src/contexts/investigation/presentation/`
- **Fix:** Replace with `<Skeleton />` or `<RemediationsEmptyState state="loading" />` / `<FeedbackEmptyState state="loading" />`.

## Agent Roles Are an Exhaustive Enum

- **Owner:** investigation context
- **Preconditions:** Any component rendering an agent role icon must use the `AGENT_ROLE_META` map.
- **Postconditions:** Adding a new agent role to `AGENT_ROLES` requires adding it to `AGENT_ROLE_META` (TypeScript will enforce via `Record<AgentRole, ...>`).
- **Invariants:** `AGENT_ROLES` in `domain/incident-stream-types.ts` matches the upstream `Evidence.agentRole` enum in `core/docs/openapi.yaml`. Cardinality = 6.
- **Verify:** `grep -c "'log_analyst'\|'metric_analyst'\|'infra_inspector'\|'orchestrator'\|'scout'\|'diagnosis_verifier'" apps/dashboard/src/contexts/investigation/domain/incident-stream-types.ts | grep -q '6'`
- **Fix:** If upstream adds a new role, sync the enum and the meta map in the same commit.

## SSE Proxy Stays Generic

- **Owner:** shared context (NOT investigation)
- **Preconditions:** The SSE proxy at `notifications-stream-handler.ts` must remain consumer-agnostic so other features (notification bell, future widgets) can also subscribe.
- **Postconditions:** No imports from `@/contexts/investigation/*` in the proxy file.
- **Invariants:** The dependency arrow points from investigation -> shared, never the reverse.
- **Verify:** `! grep "@/contexts/investigation" apps/dashboard/src/contexts/shared/api/notifications-stream-handler.ts`
- **Fix:** If the SSE proxy needs to behave differently for incident-detail, do the filtering on the **client** in `useIncidentStream`, never in the proxy.

## BFF Audit Param Allowlist

- **Owner:** audit context (Sprint 2)
- **Preconditions:** The `/api/audit` BFF accepts only allowlisted `resourceType` values.
- **Postconditions:** Invalid `resourceType` returns 400.
- **Invariants:** `ALLOWED_AUDIT_RESOURCE_TYPES` constant exists in `audit/domain/types.ts` and is referenced by `audit/api/audit-handler.ts`.
- **Verify:** `grep "ALLOWED_AUDIT_RESOURCE_TYPES" apps/dashboard/src/contexts/audit/domain/types.ts && grep "ALLOWED_AUDIT_RESOURCE_TYPES" apps/dashboard/src/contexts/audit/api/audit-handler.ts`
- **Fix:** Add the constant to `audit/domain/types.ts` and import it from the handler.

## No Barrel Imports

- **Owner:** Project-level rule (see root CLAUDE.md)
- **Preconditions:** Imports use direct deep paths.
- **Postconditions:** `@/contexts/<name>/index` imports are forbidden.
- **Invariants:** Zero matches for `from '@/contexts/(investigation|audit|shared)';` (no trailing path).
- **Verify:** `! grep -rE "from '@/contexts/(investigation\|audit\|shared)';" apps/dashboard/src/contexts/investigation/ apps/dashboard/src/contexts/audit/`
- **Fix:** Replace with the direct deep path (e.g. `@/contexts/investigation/domain/types`).

## Tenant + Incident Isolation in SSE Hook

- **Owner:** investigation context (Sprint 1)
- **Preconditions:** The hook must never expose events for incidents other than the one passed to it.
- **Postconditions:** A cross-incident SSE event payload (e.g. for incident X) does not trigger handlers registered for incident Y.
- **Invariants:** `use-incident-stream.ts` references `incidentId` in its event-filter logic.
- **Verify:** `grep "incidentId" apps/dashboard/src/contexts/investigation/presentation/hooks/use-incident-stream.ts`
- **Fix:** Add a guard `if (event.data.incidentId !== incidentId) return;` before dispatching to subscribers.

## CORE_API_URL Graceful Degradation

- **Owner:** investigation context (Sprint 1)
- **Preconditions:** When `CORE_API_URL` is unset (mock mode), the SSE hook must not throw, must not log errors, and must allow the page to function with SSR data only.
- **Postconditions:** The page renders without console errors when `CORE_API_URL=""`.
- **Invariants:** `use-incident-stream.ts` handles the no-stream case by setting status to `'disconnected'` and rendering the dev-mode banner copy.
- **Verify:** Manual orchestrator check post-merge — confirm dev server starts cleanly with no `CORE_API_URL` set.
- **Fix:** Wrap EventSource creation in a try/catch; on failure, set status without throwing.

---

**Dependency direction recap:**
- `shared` does not depend on `investigation` or `audit`.
- `investigation` and `audit` depend on `shared` only via `lib/api/*` and `presentation/components/toast-provider`.
- The SSE flow: shared SSE proxy -> investigation hook (filters by incidentId) -> investigation components.
- The audit flow: audit BFF -> investigation `<LiveActivityTimeline>` (which imports `AuditEntry` from `audit/domain/types`).
- Investigation MAY import from audit (it does, for `AuditEntry`). Audit MUST NOT import from investigation.
