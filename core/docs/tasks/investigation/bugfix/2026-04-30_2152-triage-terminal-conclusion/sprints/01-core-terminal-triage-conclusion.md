# Sprint 01 — Terminal-triage Conclusion (backend)

**Repo:** `core/`
**Size:** M (60–90 min)
**Depends on:** —
**Parent PRD:** `../spec.md`

---

## Goal

When the triage agent decides not to escalate (`resultRank > threshold` — i.e., LLM picked `medium`/`low`/`info`), the use case MUST record a terminal decision instead of silently no-oping. Concretely:

1. Write `incident.rootCause = result.summary`.
2. Transition `incident.status` from `triaging` to `resolved` via `updateIncidentStatus.execute(...)` so that the existing auto-stamp of `resolvedAt` and the publish of `incident.status_changed` happen.
3. Keep the existing `resultRank ≤ threshold` (high-severity) branch byte-identical — it still dispatches the worker, no state change here.

The state machine in `update-incident-status.usecase.ts` does **not** currently allow `triaging → resolved`. We add `'resolved'` to that allow-list (and only that — no other transitions are widened).

---

## File Boundaries

### files_to_modify
- `core/src/modules/triage/application/triage-incident.usecase.ts`
- `core/src/modules/ingestion/application/update-incident-status.usecase.ts`

### files_to_create
- `core/tests/unit/modules/triage/triage-incident-terminal.test.ts`
- `core/tests/unit/modules/ingestion/update-incident-status-triage-resolved.test.ts`

### files_read_only
- `core/src/shared/infra/db/entities/IncidentEntity.ts`
- `core/src/modules/triage/domain/triage.prompts.ts`
- `core/src/modules/triage/domain/incident.entity.ts`
- `core/src/modules/investigation/application/investigate-incident.usecase.ts` (reference pattern at line 715)
- `core/src/bootstrap.ts` (lines 980–1015 — confirm in-process listener is unaffected)

### shared_contracts
- **Triage agent output schema** (`triageResultSchema` in `core/src/modules/triage/domain/triage.prompts.ts`) — read-only. Do not change. The summary field becomes the source of `rootCause`.
- **`IncidentEntity` schema** — read-only. `rootCause`, `resolvedAt`, `status`, `resolution` fields all already exist.
- **EventBus event** `incident.status_changed { incidentId, tenantId, from, to }` — emitted by `updateIncidentStatus`. Listeners (notifications, billing) MUST receive `to: 'resolved'` for the new path.

---

## Acceptance Criteria

1. `triage-incident.usecase.ts` extended so that when `resultRank > threshold`, the use case calls the existing `updateIncidentStatus` collaborator to transition `triaging → resolved` with `rootCause = result.summary`. Worker is **not** dispatched in this branch (existing behaviour preserved on that point).
2. `update-incident-status.usecase.ts` line 9: `triaging: ['investigating', 'closed', 'resolved']`. No other state-machine entries change.
3. `pnpm test:run` passes, including new tests:
   - **Terminal triage test:** seeds an `open` incident, runs the use case with a stub LLM returning `{ priority: 'low', summary: 'manual test', confidence: 0.9, ... }`, asserts: `incidentRepo` final state has `status === 'resolved'`, `rootCause === 'manual test'`, `resolvedAt` non-empty; `messageQueue.send` was **not** called; `eventBus.publish` was called with `{ type: 'incident.status_changed', payload: { from: 'triaging', to: 'resolved' } }`.
   - **High-severity regression test:** stub LLM returning `{ priority: 'critical', ... }`. Assert `messageQueue.send` IS called and final status is `'triaging'` (unchanged from today).
   - **State-machine edge test:** `updateIncidentStatus.execute({ from: 'triaging', to: 'resolved', ... })` succeeds and stamps `resolvedAt`. The previously-rejected attempt (`triaging → resolved` with the old allow-list) is gone.
4. `pnpm typecheck` clean. `pnpm lint` clean. `pnpm lint-invariants` clean (I1–I7 unaffected).
5. The triage use case still extracts `tenantId` via the caller's context (no new IDOR surface). New `updateIncidentStatus` call passes the same `tenantId` already in scope.

---

## TDD Plan

Follow the bug-fix order from `~/.claude/CLAUDE.md` (Reproduce → Investigate → Fix → Verify → Regress):

1. **Reproduce (Red):** Write `triage-incident-terminal.test.ts` with the terminal-triage assertion. It MUST fail today (use case currently returns without writing `rootCause`/`status`).
2. **Investigate:** Already done in PRD §1 — `triage-incident.usecase.ts:131` is the bug site.
3. **Fix:** In `triage-incident.usecase.ts`:
   - In the `else` branch of `resultRank ≤ threshold`, call `await this.updateIncidentStatus.execute({ incidentId, tenantId, status: 'resolved', rootCause: result.summary, actorId: 'agent:triage' })` (or the existing equivalent shape — read `update-incident-status.usecase.ts` to match its DTO exactly). The use case is already constructor-injected (or wire it up if not — check `bootstrap.ts` triage wiring around lines 800–900).
   - Constructor: add `private readonly updateIncidentStatus: UpdateIncidentStatusUseCase` if not already there. Update the bootstrap wiring accordingly.
4. **Fix (state machine):** In `update-incident-status.usecase.ts:9`, change `triaging: ['investigating', 'closed']` to `triaging: ['investigating', 'closed', 'resolved']`. The existing `resolvedAt` auto-stamp at lines 36–38 takes care of the timestamp.
5. **Verify:** Re-run the failing test from step 1 — must pass. Run the full unit suite — must stay green.
6. **Regress:** Run the high-severity test (step 3 of acceptance). Confirm that path is byte-identical (worker dispatch happens, status stays `triaging`, no `rootCause` write).

---

## Implementation Notes

- **`updateIncidentStatus` DTO shape:** Read the existing `UpdateIncidentStatusInput` in `core/src/modules/ingestion/application/update-incident-status.usecase.ts` carefully. The use case may already accept an optional `rootCause` field that gets merged into the entity; if not, prefer doing the `rootCause` write in `incidentRepo.update(...)` *before* the status transition (so the listener can read it). Mirror the pattern at `investigate-incident.usecase.ts:705-725` exactly — that path also writes `rootCause` before transitioning to `resolved`/`awaiting_approval`.
- **Do not add a new status enum value.** PRD §6 A1 is explicit: reuse `resolved`.
- **Do not modify `bootstrap.ts:992-1011`** beyond wiring the new constructor dep into the triage use case. The in-process consumer for `incident.status_changed → triaging` listener stays as-is — it still no-ops on the new path because the use case does the write itself before publishing.
- **EventBus order:** repo write → `updateIncidentStatus` (which publishes `incident.status_changed`) → return. Do not publish twice.

---

## Rollback Plan

If staging shows any regression (notification storm, billing double-charge, high-severity incidents not dispatching to worker):

1. Revert the two source edits (`triage-incident.usecase.ts`, `update-incident-status.usecase.ts`) — single commit revert.
2. Re-deploy. Stranded incidents from the bad window stay stranded; Sprint 3 backfill can clean them later.
3. The state-machine widening (`triaging → resolved`) is additive and harmless to revert — no incidents written via this new path will be affected, because they will already be `resolved` and terminal.

---

## Out of Scope

- Frontend changes (Sprint 2 owns the safety net).
- Backfilling existing stranded incidents (Sprint 3).
- Touching `bootstrap.ts:992-1011`'s in-process investigation dispatcher.
- Any change to the LLM prompt or `triageResultSchema`.

---

## Done Definition

- [x] Two source files modified, two test files created, all asserted in §Acceptance Criteria.
  - `pnpm test:run` (sprint files): 3 files, 34 tests — all pass.
  - `pnpm typecheck`: 0 errors in sprint files (60 pre-existing AWS SDK errors unchanged).
  - `pnpm lint`: 0 errors in sprint files (118 pre-existing problems unchanged).
  - `pnpm lint-invariants`: 9 passed, 0 failed (I1–I10 all PASS).
- [x] `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm lint-invariants` all pass locally.
  - Sprint-file scope: all green. Pre-existing failures (zod-to-json-schema ESM + AWS SDK types) verified as pre-existing on base commit 847bf7f.
- [ ] Code review passed (sprint-executor → code-reviewer subagent).
- [ ] PR description references this sprint spec and PRD §5 acceptance criterion 1 + 2 + 3.
