# Invariants — Triage Terminal Conclusion PRD

These are PRD-scoped invariants. Each must hold from the moment Sprint 01 merges through every subsequent sprint and after final deploy. The project-level `core/INVARIANTS.md` rules (I1–I7) apply unchanged on top of these.

---

## TT1 — Triage never silently strands an incident

- **Owner:** `core/src/modules/triage/application/triage-incident.usecase.ts`
- **Preconditions:** Caller has supplied a valid `incidentId` and `tenantId`; the incident exists at `status === 'triaging'`.
- **Postconditions:** When the use case returns successfully, **either** (a) the worker has been enqueued AND the incident is still `triaging` (high-severity branch — unchanged from today), **or** (b) the incident has been transitioned to a terminal state (`resolved`) with `rootCause` populated and `incident.status_changed` published. There is no third outcome.
- **Invariants:** No code path inside the use case may return without one of (a) or (b) occurring. A throw is permitted (caller handles); a silent no-op is not.
- **Verify:** `pnpm test:run tests/unit/modules/triage/triage-incident-terminal.test.ts` — both the terminal-triage test and the high-severity regression test must pass.
- **Fix:** If a new branch is added to the use case and an incident is observed at `triaging` with no further activity, audit the new branch for a missing terminal write or worker dispatch.

---

## TT2 — State-machine widening is minimal

- **Owner:** `core/src/modules/ingestion/application/update-incident-status.usecase.ts`
- **Preconditions:** Caller invokes `execute` with `from`/`to` derived from a real incident.
- **Postconditions:** Only the `triaging` row in `VALID_TRANSITIONS` gains `'resolved'`. Every other row in the table is byte-identical to its pre-PRD value.
- **Invariants:** No other state-machine entry is widened by this PRD. A future PRD may widen others, but not this one.
- **Verify:** `git diff main -- core/src/modules/ingestion/application/update-incident-status.usecase.ts` shows changes only on the `triaging:` line. The test `tests/unit/modules/ingestion/update-incident-status-triage-resolved.test.ts` covers the new edge.
- **Fix:** If a different entry was widened in this PRD, revert that line; if the widening is genuinely needed, raise it as a separate PRD.

---

## TT3 — Tenant scoping is preserved on every write path

- **Owner:** All write paths in this PRD: triage use case (Sprint 1), backfill script (Sprint 3).
- **Preconditions:** A `tenantId` is in scope at every entry point — JWT-derived for live traffic; iterated explicitly in the backfill loop.
- **Postconditions:** Every `incidentRepo.update`, `incidentRepo.updateStatus`, and `updateIncidentStatus.execute` call carries the same `tenantId` that scoped the read.
- **Invariants:** No write call uses `tenantId === '*'` or omits the tenant scope. The backfill script never iterates incidents across tenants in a single call.
- **Verify:** Grep the new code for `tenantId`. `grep -nE "tenantId\s*:\s*['\"]\\*['\"]" core/scripts/backfill-stranded-triage-incidents.ts` returns no matches.
- **Fix:** If a non-scoped write is found, add a tenant guard before the write. If discovered post-deploy, audit the audit-log for affected rows and raise an incident.

---

## TT4 — Frontend safety net is informational only

- **Owner:** `web/apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/root-cause-card.tsx` and the helper at `presentation/lib/is-stale-investigation.ts`.
- **Preconditions:** Component receives an `Incident` and (optionally) a feed-derived `latestEvidenceAt`.
- **Postconditions:** When the helper returns `true`, the UI renders one i18n-bound paragraph under the existing spinner. The component dispatches no network request, mutates no state, fires no analytics event.
- **Invariants:** No CTA, no retry button, no API call, no `useEffect` side effect, no `setInterval`. The threshold logic is a pure function with `now: number` injected for testability.
- **Verify:** `pnpm test web/apps/dashboard -- is-stale-investigation`. Manual code review of `root-cause-card.tsx` for absence of fetch/mutation calls inside the new conditional.
- **Fix:** If any side effect is introduced into the safety-net branch, remove it; the goal of A3 is a *dumb* warning.

---

## TT5 — The backfill is idempotent and bounded

- **Owner:** `core/scripts/backfill-stranded-triage-incidents.ts`
- **Preconditions:** Script invoked with valid AWS credentials and (optionally) `--tenant`/`--limit`/`--apply` flags.
- **Postconditions:** Without `--apply`, the script writes nothing. With `--apply`, the script writes only to incidents that match the selector (`status === 'triaging'`, `updatedAt > 5 min ago`, `rootCause` empty, has coordinator agent_reasoning evidence). Re-running the script after a successful run is a no-op (selector excludes already-resolved incidents because `rootCause` is now populated).
- **Invariants:** The script never writes more than `--limit` (default 100) incidents per invocation. Output is deterministic for a fixed input.
- **Verify:** Unit tests in `tests/unit/scripts/backfill-stranded-triage-incidents.test.ts` cover dry-run, single-apply, idempotent re-apply, and cross-tenant isolation. `--apply --limit 0` writes nothing.
- **Fix:** Selector regression — re-add the missing predicate. Limit regression — re-add the cap before the write loop.

---

## TT6 — Existing high-severity investigation flow is byte-identical

- **Owner:** `core/src/modules/triage/application/triage-incident.usecase.ts` and `core/src/bootstrap.ts:992-1011`.
- **Preconditions:** Triage classifies an incident as `priority` rank ≤ threshold (today: `critical` or `high`).
- **Postconditions:** Worker is enqueued via `messageQueue.send`; status remains `triaging` until the worker transitions it to `investigating`. The new code path adds nothing here.
- **Invariants:** The high-severity branch's set of side effects is the same as today: one `messageQueue.send`, one `agent_reasoning` evidence row from the coordinator, one `incident.status_changed { from: open, to: triaging }`. No additional `updateIncidentStatus` call, no `rootCause` write.
- **Verify:** The high-severity regression test in Sprint 1's `triage-incident-terminal.test.ts` asserts this. The existing `bootstrap.ts` listener test (if any) stays green.
- **Fix:** If the high-severity test starts to fail because of an over-reach in the use case fix, narrow the new write to the `else` branch only.
