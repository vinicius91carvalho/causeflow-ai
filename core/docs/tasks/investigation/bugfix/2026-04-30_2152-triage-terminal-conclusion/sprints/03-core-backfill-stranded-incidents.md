# Sprint 03 — Backfill Stranded Incidents (one-shot script)

**Repo:** `core/`
**Size:** S (30–45 min)
**Depends on:** Sprint 01 deployed to the target environment
**Parent PRD:** `../spec.md`

---

## Goal

A one-shot script that finds incidents stranded in `status === 'triaging'` due to the pre-fix bug and transitions them to `resolved` with `rootCause` populated from the existing coordinator agent_reasoning evidence. Runs once per environment (staging, then prod). Default behaviour is dry-run; an explicit `--apply` flag performs the writes.

This sprint runs **after** Sprint 01 is deployed — Sprint 01's state-machine widening (`triaging → resolved`) is what makes the writes valid.

---

## File Boundaries

### files_to_create
- `core/scripts/backfill-stranded-triage-incidents.ts`
- `core/tests/unit/scripts/backfill-stranded-triage-incidents.test.ts`

### files_to_modify
- `core/package.json` — add `"backfill:stranded-triage": "tsx scripts/backfill-stranded-triage-incidents.ts"` to `scripts`.

### files_read_only
- `core/src/shared/infra/db/entities/IncidentEntity.ts`
- `core/src/modules/ingestion/application/update-incident-status.usecase.ts`
- `core/src/modules/triage/domain/incident.entity.ts` — for the `Incident` and `Evidence` types
- `core/src/bootstrap.ts` — for the wiring pattern of repos/use cases (mirror it in the script)

### shared_contracts
- The script MUST drive writes through `UpdateIncidentStatusUseCase.execute(...)` (so the `incident.status_changed` event fires and any listeners receive it consistently). It MUST NOT call `incidentRepo.update(...)` directly.
- The script MUST be tenant-scoped per iteration: scan one tenant at a time, never `tenantId === '*'`.

---

## Acceptance Criteria

1. **Selector logic:** the script identifies incidents matching ALL of:
   - `status === 'triaging'`
   - `updatedAt` older than 5 minutes ago (so we don't race in-flight triages)
   - `rootCause` is empty / undefined
   - At least one evidence row exists with `agent === 'coordinator'` and `evidenceType === 'agent_reasoning'`
2. **For each match:** read the most-recent coordinator `agent_reasoning` evidence → extract `summary` (or whatever string field the evidence record uses for the agent's conclusion) → call `updateIncidentStatus.execute({ incidentId, tenantId, status: 'resolved', rootCause: <that summary>, actorId: 'script:backfill-stranded-triage' })`. Auto-stamp of `resolvedAt` happens inside that use case.
3. **Tenant scoping:** the script iterates `tenants` first, then `incidents` per tenant. It logs `Scanning tenant <tenantId>...` per iteration. No write happens against a wildcard tenant.
4. **Dry-run by default:** running with no flags prints the planned writes to stdout (`[DRY-RUN] would resolve <incidentId> with rootCause "..."`) and exits 0 without writing. `--apply` actually writes. `--tenant <tenantId>` scopes to a single tenant. `--limit <N>` caps the writes per run (default 100).
5. **Test (in-memory):** with a fake repo seeded with three incidents — (a) stranded match, (b) stranded but missing coordinator evidence, (c) freshly-`triaging` (<5 min) — assert that only (a) gets transitioned. `--apply=false` writes nothing; `--apply=true` writes one transition for (a). `eventBus.publish` is called exactly once.
6. **Cross-tenant isolation test:** seed two tenants, each with one stranded match. Run with `--tenant tenant_A --apply`. Assert tenant_B's incident is untouched.
7. **`pnpm typecheck`** and **`pnpm lint`** clean. The script lives in `scripts/` (not `src/`) so it is exempt from `pnpm lint-invariants` cross-module rules — but it MUST still respect the dependency rule (no infra → domain shortcuts).
8. **Documentation:** add a header comment (single line) pointing at the parent PRD.

---

## TDD Plan

1. **Red:** Write `backfill-stranded-triage-incidents.test.ts` with the seeded scenario (a/b/c plus cross-tenant). Tests instantiate the script's main exported function with injected fakes for `incidentRepo`, `tenantRepo`, `updateIncidentStatus`, and `logger`. Fails because the script doesn't exist.
2. **Green:** Implement the script as a default-exported `runBackfill(deps, opts)` function for testability, with a thin CLI wrapper at the bottom (`if (require.main === module) { ... }` pattern). Re-run tests.
3. **Wire CLI flags** (`--apply`, `--tenant`, `--limit`) using the existing arg parsing pattern in any sibling script under `core/scripts/` — match style. If no sibling exists, simple `process.argv` parsing is fine; do not add a new dependency.
4. **Manual dry-run on staging:** before adding `--apply` in production, run the script locally pointed at staging credentials with `--limit 5` (no apply). Eyeball output; confirm targets are sane.
5. **Apply on staging:** rerun with `--apply --limit 100`. Confirm via dashboard that the reference incident `55995f33-8ed5-4f62-b1de-c9159e1bc0ad` now shows the green "Root cause identified" card.
6. **Apply on prod:** same procedure, after staging soak.

---

## Implementation Notes

- **Repo wiring:** mirror `core/src/bootstrap.ts` lines that build `incidentRepo` and `tenantRepo`. Do not import from `bootstrap.ts` directly — it has side-effects. Inline a minimal composition for the script.
- **Pagination:** if the per-tenant scan is paginated, the script should iterate until the cursor is empty or the `--limit` is hit. Use the existing repo cursor/iterator API; do not write a new one.
- **Idempotency:** the selector excludes incidents that already have `rootCause` populated, so a second run is a no-op. Do NOT also exclude on `status === 'resolved'` only — both checks defend in depth.
- **Logging:** plain `console.log` is fine; this is a script, not a service. Prefix output with `[backfill]`.

---

## Rollback Plan

Backfill is one-shot and additive. Rollback options:

1. If dry-run output looked wrong: don't run with `--apply`. No state changed.
2. If `--apply` ran and produced wrong writes: run an inverse one-shot that reads the audit trail of `incident.status_changed` events from this run's window and reverts each affected incident to `triaging` with `rootCause` cleared. **Author this only if needed** — do not pre-build it.
3. The script is idempotent on the selector side, so re-running after a partial failure is safe.

---

## Out of Scope

- Continuous sweeper (PRD §6 A4 — explicitly one-shot).
- Status transitions other than `triaging → resolved`.
- Touching `inconclusive` incidents.
- Fixing root-cause text quality if the coordinator's `summary` is too short.

---

## Done Definition

- [ ] Script + test created; tests green for both single-tenant and cross-tenant cases.
- [ ] `pnpm package.json` script entry added.
- [ ] Dry-run output reviewed manually against staging.
- [ ] `--apply` run on staging; reference incident confirmed green-card in dashboard.
- [ ] `--apply` run on prod (after staging soak ≥ 1 hour with no regressions).
- [ ] Code review passed.
