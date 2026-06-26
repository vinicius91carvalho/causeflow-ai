# Invariants — evidence-required-no-fallback

Cross-cutting contracts introduced by this PRD. Each must hold across every sprint and every consumer surface. Verify commands run from `/root/projects/causeflow/core/`.

These mirror the new project-level invariants `I9–I11` added in Sprint 02 to `core/INVARIANTS.md`. The PRD-local copy keeps the contracts self-contained for any sprint executor reading only this directory.

---

## Synthesis Never Runs With Zero Evidences (I9)

- **Owner:** core / investigation module (`src/modules/investigation/application/investigate-incident.usecase.ts`)
- **Preconditions:** The orchestrator agent has completed at least one run for the current `(tenantId, incidentId)`. Evidence repository is reachable.
- **Postconditions:** Before any call to `synthesizeWithValidation`, evidences are loaded via `evidenceRepo.findByIncident(tenantId, incidentId)`. If `evidences.length === 0`, the orchestrator agent is re-invoked exactly once with the strict `ORCHESTRATOR_REINVOCATION_PROMPT`. After re-invocation, evidences are re-loaded; if still zero, the use case calls `terminateInconclusive(...)` and returns. Synthesis is NOT invoked.
- **Invariants:** No production code path calls `synthesizeWithValidation` (or any LLM-backed synthesis) when `evidences.length === 0`. The pre-synthesis gate is the sole entry point.
- **Verify:** `grep -nE 'pre_synthesis_zero_evidence' src/modules/investigation/application/investigate-incident.usecase.ts | grep -q . && exit 0 || exit 1`
- **Fix:** Insert the pre-synthesis gate (load evidences, check length, re-invoke or terminate) before any synthesis call. Reference: Sprint 02 spec, this PRD directory.

---

## No Fabricated Unvalidated Findings (I10)

- **Owner:** core / investigation module (`src/modules/investigation/application/investigate-incident.usecase.ts`)
- **Preconditions:** Synthesis has been attempted and either succeeded (returning `findings` with `evidenceIds.length >= 1` per finding) or failed (citation errors, exhausted retries).
- **Postconditions:** On synthesis success, the persisted `InvestigationResult.findings` array contains only findings whose `evidenceIds` reference real records in the evidence repository. On synthesis failure (exhausted citation retries), the use case routes to `terminateInconclusive` — no fabricated findings are persisted.
- **Invariants:** No production code path constructs an `InvestigationResult` with any `findings[N].evidenceIds = []`. The previously-existing fallback branch (`'Synthesis with citation failed — falling back to unvalidated orchestrator findings'`) MUST NOT exist in `src/`. The helper `stringsToFindings` is removed from production code (allowed only in `tests/` fixtures, if at all).
- **Verify (negative — must produce no matches):**
  - `! grep -rn 'Synthesis with citation failed — falling back' src/ --include='*.ts' | grep -q .`
  - `! grep -rn 'stringsToFindings' src/ --include='*.ts' --exclude-dir=__test-fixtures__ | grep -q .`
- **Fix:** Delete the catch-block fallback in `investigate-incident.usecase.ts` and route exhausted-citation cases to `terminateInconclusive`. Reference: Sprint 02 spec.

---

## Inconclusive Outcome Is Persisted And Emitted (I11)

- **Owner:** core / investigation module (`src/modules/investigation/application/investigate-incident.usecase.ts`, `src/workers/investigation-worker.ts`)
- **Preconditions:** The use case has decided to terminate as inconclusive (zero evidences after re-invocation, OR exhausted-citation retries with persistent invalid IDs).
- **Postconditions:** The incident DB record is updated with `status='inconclusive'` and `resolution` set to a string starting with the literal prefix `'inconclusive:'`. The EventBus publishes an `investigation.inconclusive` event, which the bootstrap-wired EventBus → SQS bridge forwards to the progress queue.
- **Invariants:** Every `inconclusive` terminal carries a `resolution` reason. No `inconclusive` record exists in DynamoDB without a corresponding SQS event having been published.
- **Verify:** Integration test `tests/integration/modules/investigation/investigation-inconclusive-flow.test.ts` (added in Sprint 02) asserts both the persisted DB shape and the SQS event payload. CI `pnpm test:integration` enforces this.
- **Fix:** Use the `terminateInconclusive` private method as the sole code path that produces the inconclusive terminal. Do not directly call `incidentRepo.update({ status: 'inconclusive' })` from anywhere else.

---

## Cross-repo: IncidentStatus enum parity

- **Owner:** core defines, web consumes.
- **Invariant:** The `IncidentStatus` union in `web/apps/dashboard/src/...` MUST include `'inconclusive'` whenever core's `src/shared/domain/types.ts` defines it. Drift between repos surfaces as a TypeScript "unknown status" branch in the dashboard, breaking the new UX.
- **Verify (web):** `grep -nE "'inconclusive'" apps/dashboard/src/lib apps/dashboard/src/contexts | grep -q .`
- **Fix:** When extending the enum in core, immediately mirror the change in web in the Sprint 04 web PR.
