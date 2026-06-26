# Plan: Investigation Evidence Required — No Fallback (PRD)

## Context

**Reported failure** — staging incident `3e2da7ae-3491-47f4-a3eb-69374b885c5a` (tenant `org_3CIe2PY6G6xwnUu9TA0oopGUW9u`). Dashboard shows the investigation as errored / degraded; CloudWatch trace (`/ecs/causeflow-staging-worker`) shows the orchestrator agent ran 3 specialist sub-agents (`log_analyst, metric_analyst, infra_inspector`), reported 3 findings, then hit:

```
ZodError: findings[N].evidenceIds — too_small (min:1) "Each finding must cite at least one evidenceId"
  ×3 attempts (synthesis retry loop)
→ "Synthesis with citation failed — falling back to unvalidated orchestrator findings"
   (0 evidences available)
```

**Diagnosis** — confirmed by reading `core/src/modules/investigation/application/investigate-incident.usecase.ts`:
- Synthesis schema (line 181) requires `evidenceIds.min(1)` per finding.
- Evidence is created exclusively via the `cite_evidence` tool during the agent run (line 87).
- For this incident, the orchestrator agent **never called `cite_evidence`** → 0 Evidence records in DynamoDB → `evidences.length === 0` at synthesis time → no possible LLM output can satisfy `min(1)` → 3 LLM attempts wasted → fallback path (line 1424-1431) produces fake findings with `evidenceIds: []` and `recommendedActions: []`.
- The orchestrator's system prompt (`agent-configs.ts:367-479`) already declares cite_evidence MANDATORY. The agent ignored it. Strengthening the prompt alone is insufficient — we need a deterministic gate.
- Regression introduced by commit `d3d0771` (Apr 17, 2026) which added the `min(1)` constraint. Before that, findings were `z.array(z.string())` and this failure mode could not occur.

**User-stated requirement (decisive)** — "*O ideal é sempre o agente gerar evidências se chegou a uma conclusão. Caso não encontrou uma conclusão, ele deve continuar procurando. Ele não pode chegar a uma síntese sem evidência nenhuma.*" Translated: synthesis MUST never run with 0 evidences. The agent must either (a) cite evidence for every claim, or (b) terminate as `inconclusive` with no fake findings.

**Intended outcome** — replace the silent "unvalidated fallback" path with a clean `inconclusive` terminal state, gated by a pre-synthesis evidence check and a single bounded re-invocation of the agent. No evidence-fabrication, no wasted LLM cost, no misleading dashboard output.

---

## Approach

This is a **PRD + Sprint** task. PRD lives in the **`core` repo** (first in the deploy chain `relay → core → web`); sprints touch `core` and `web`.

**PRD location (to be created on approval):**
```
/root/projects/causeflow/core/docs/tasks/investigation/bugfix/2026-04-27_2359-evidence-required-no-fallback/
├── spec.md
├── progress.json
├── INVARIANTS.md
└── sprints/
    ├── 01-diagnostic-quantification.md
    ├── 02-pre-synthesis-gate-and-inconclusive.md
    ├── 03-orchestrator-prompt-hardening.md
    └── 04-api-and-dashboard-inconclusive-ux.md
```

(Area `investigation` does not yet exist under `docs/tasks/` — current siblings: `bugfix, infra, integration, notifications, testing`. Creating `investigation/` mirrors the pattern of `integration/bugfix/...` for the integration module.)

---

## Sprint Decomposition (4 sprints, dependency-ordered)

### Sprint 01 — Diagnostic & Quantification *(no code change; report artifact only)*

**Goal:** Quantify how many investigations have hit the failed-synthesis path since the regression (Apr 17). Output sizes the urgency and validates that S2-S4 are necessary.

**Work:**
- CloudWatch Insights query against `/ecs/causeflow-staging-worker` for the date range `2026-04-17 → today`, pattern `"Synthesis with citation failed"`. Repeat for `causeflow-production-worker` if the log group exists.
- Aggregate: total incidents, count hitting fallback, % of total, distinct tenants affected, sample incident IDs (first 10).
- Output: `docs/tasks/.../diagnostic-report.md`.

**Files:** report only — no source changes.

**Acceptance:** report committed; numbers cited; sample incident IDs verified by re-running the CloudWatch query.

---

### Sprint 02 — Pre-Synthesis Gate + Agent Re-Invocation + Inconclusive Terminal *(core)*

**Goal:** Make it structurally impossible for synthesis to run with 0 evidences. Replace the silent fallback path with a clean `inconclusive` outcome.

**Files to modify:**
- `core/src/modules/investigation/application/investigate-incident.usecase.ts`
  - Insert pre-synthesis gate before `synthesizeWithValidation` is called: load evidences, if `length === 0` → re-invoke orchestrator agent **once** with a continuation prompt instructing it to call `cite_evidence` for every finding or terminate without findings.
  - After re-invocation, re-check: if still `length === 0` → mark `outcome = 'inconclusive'`, persist `inconclusive_reason`, publish `investigation.inconclusive` SQS event, return early. No synthesis call.
  - Remove the unvalidated-fallback branch (current lines ~1424-1431); replace with route to inconclusive terminal.
  - Update the existing 3-attempt synthesis retry loop (lines 351-393): if all attempts exhaust due to citation errors, also route to inconclusive (not fallback).
  - Delete or restrict `stringsToFindings` (line 98) — the only caller was the fallback. If kept, scope it to test fixtures.
- `core/src/modules/investigation/domain/investigation.types.ts` — add `outcome: 'completed' | 'inconclusive' | 'failed'` (or extend existing status enum). Add `inconclusive_reason?: string`.
- `core/src/shared/infra/db/entities/<IncidentEntity>.ts` — extend ElectroDB attributes to persist `outcome` and `inconclusive_reason`.
- `core/src/workers/investigation-worker.ts` — handle the `inconclusive` outcome alongside the existing `completed`/`failed` SQS publish branches.

**Tests:**
- Unit: pre-synthesis gate — 0 evidences after run → re-invokes agent.
- Unit: re-invocation produces evidences → proceeds to synthesis successfully.
- Unit: re-invocation still 0 evidences → routes to inconclusive, **never** calls synthesis.
- Integration: full investigation use case with stubbed agent producing zero `cite_evidence` calls → asserts incident persisted with `outcome='inconclusive'` and `recommendedActions` not present.
- Integration: existing happy-path synthesis still passes (no regression).

**Acceptance:**
- `pnpm test:run` and `pnpm test:integration` green.
- `pnpm lint-invariants` passes (new invariant file landed in S2 — see INVARIANTS section).
- Manual verification: re-run an investigation similar to the failing incident in staging — confirm it terminates as `inconclusive` rather than fallback.

---

### Sprint 03 — Orchestrator Prompt Hardening + Post-Agent Contract Check *(core)*

**Goal:** Reduce the rate at which the agent forgets `cite_evidence` in the first place. Add telemetry to detect drift.

**Files to modify:**
- `core/src/modules/investigation/application/agent-configs.ts` — strengthen `ORCHESTRATOR_SYSTEM_PROMPT` (currently declares cite_evidence "MANDATORY" but agent still skipped it):
  - Add explicit termination contract: "If after exhaustive tool use you cannot find supporting evidence, you MUST terminate WITHOUT producing findings. There is no fallback. Un-cited findings will be discarded and the investigation marked inconclusive."
  - Add concrete example of correct flow: tool call → `cite_evidence` → finding referencing the citation.
- `core/src/modules/investigation/application/investigate-incident.usecase.ts` — post-agent telemetry: log structured warning `{ incidentId, agentReportedFindings, evidences.length, toolCalls.length, agentRole: 'orchestrator', event: 'orchestrator_failed_to_cite' }` whenever the agent ran tools but produced 0 evidences. This is the signal we monitor.

**Eval test (Promptfoo):**
- New `tests/eval/orchestrator-cites-evidence.yaml` — synthetic incident, runs the orchestrator in-process against a stubbed tool environment (returning canned log/metric data), asserts the trace contains `>= 1` `cite_evidence` tool call.
- Wire into `pnpm test:eval` (existing harness per project CLAUDE.md).

**Acceptance:**
- Eval passes 5 consecutive runs.
- Manual: re-run a staging incident similar to the failing one and observe `cite_evidence` is called.

---

### Sprint 04 — API + Dashboard Inconclusive UX *(cross-repo: core + web)*

**Goal:** Surface the new `inconclusive` outcome to end users with a clear, actionable UX — not a generic error.

**Files to modify (core):**
- `core/src/modules/investigation/infra/investigation.routes.ts` (or incident routes — exact file located by executor) — extend GET incident response to include `outcome` and `inconclusive_reason`.
- `core/tests/integration/<incident-routes>.test.ts` — assert new fields are present in the response shape.

**Files to modify (web — `/root/projects/causeflow/web`):**
- `apps/dashboard/src/.../incidents/[id]/page.tsx` (exact path located by executor via `find apps/dashboard -path '*incidents*[id]*'`) — render an `Inconclusive` state when `incident.outcome === 'inconclusive'`:
  - Amber/yellow badge "Inconclusive — Insufficient Evidence"
  - Body: "The investigation agent could not find sufficient evidence to support a conclusion. Tool calls made: N. Suggested next steps: provide additional context, re-run with broader log/metric scope, or escalate to a human SRE."
  - Visually distinct from `failed` (red) and `completed` (green).
- API client types (`apps/dashboard/src/lib/api/...`) — add `outcome` and `inconclusive_reason` to the Incident TypeScript type.

**Tests:**
- Web Playwright E2E (`pnpm test:e2e`): mock incident with `outcome='inconclusive'` → assert badge + body text rendered.
- Core integration: HTTP GET on the incident route returns the new fields.

**Acceptance:**
- Both repos build green; lint and typecheck clean.
- Playwright E2E passes the new test.
- Manual: open the failing incident URL in staging dashboard → see Inconclusive badge with explanation.

---

## INVARIANTS.md (new — created in S2)

To add to `core/INVARIANTS.md`:

### Evidence-Required-For-Synthesis
- **Owner:** Investigation module
- **Preconditions:** Investigation reached synthesis stage
- **Postconditions:** Either (a) synthesis produced an InvestigationResult with `findings[].evidenceIds.length >= 1` for every finding, **or** (b) the investigation terminated with `outcome='inconclusive'` before synthesis was attempted
- **Invariants:** No code path may construct a final InvestigationResult with `evidenceIds: []`. Synthesis MUST NOT be called when `evidences.length === 0`.
- **Verify:** `! grep -rn "stringsToFindings\|evidenceIds: \[\]" src/modules/investigation/application/ --include='*.ts' | grep -v '\.test\.ts' | grep -q .` (returns success when no offending references exist outside tests)
- **Fix:** Route to inconclusive terminal in `investigate-incident.usecase.ts` (see Sprint 02).

### No-Fabricated-Findings
- **Owner:** Investigation module
- **Invariants:** The fallback branch (`'Synthesis with citation failed — falling back to unvalidated orchestrator findings'`) MUST NOT exist in production code paths. Findings without citation must be discarded, not persisted.
- **Verify:** `! grep -rn "Synthesis with citation failed — falling back" src/ --include='*.ts' | grep -q .`

### Inconclusive-Outcome-Persisted
- **Owner:** Investigation module
- **Invariants:** When `outcome='inconclusive'` is set on an incident, the DB record MUST contain the outcome field and an `inconclusive_reason` string. Worker MUST publish an `investigation.inconclusive` SQS event before exiting.
- **Verify:** Integration test asserting the persisted record + the SQS event payload (test added in S2).

---

## Verification Plan

End-to-end manual verification once all sprints land:

1. **Reproduce the original failure** — re-trigger an investigation on staging similar to incident `3e2da7ae...` (e.g. an alert with sparse/ambiguous evidence). Expect: investigation terminates as `inconclusive` (no 3-attempt synthesis loop, no fallback findings).
2. **Confirm dashboard UX** — open the incident URL on `dashboard-staging.causeflow.ai`, see the amber "Inconclusive — Insufficient Evidence" badge with explanation.
3. **Confirm CloudWatch trace** — for the new run, expect log entries: `"Pre-synthesis gate: 0 evidences after agent run, re-invoking"`, then either `"Synthesis succeeded after re-invocation"` OR `"Investigation marked inconclusive — agent failed to cite evidence after re-invocation"`. **No** `"Synthesis attempt failed"` log spam.
4. **Confirm cost reduction** — for incidents that previously hit fallback, no synthesis LLM calls are made (saves ~3 Sonnet calls per inconclusive investigation).
5. **Run the diagnostic query again** (S1 query, after deploy) — confirm count of `"Synthesis with citation failed"` events is zero post-deploy.
6. **Run the test suites:** `cd core && pnpm test:run && pnpm test:integration && pnpm test:eval && pnpm lint-invariants` — all green. `cd web && pnpm test && pnpm test:e2e` — all green.

---

## Critical Files (paths to be modified)

**core:**
- `src/modules/investigation/application/investigate-incident.usecase.ts` — pre-synthesis gate, removal of fallback, retry-loop routing to inconclusive (S2)
- `src/modules/investigation/application/agent-configs.ts` — orchestrator prompt hardening (S3)
- `src/modules/investigation/domain/investigation.types.ts` — add `outcome` and `inconclusive_reason` (S2)
- `src/modules/investigation/infra/investigation.routes.ts` — expose new fields (S4)
- `src/shared/infra/db/entities/<IncidentEntity>.ts` — persist new fields (S2)
- `src/workers/investigation-worker.ts` — handle inconclusive SQS publish (S2)
- `INVARIANTS.md` — new invariants (S2)
- `tests/eval/orchestrator-cites-evidence.yaml` — new eval (S3)

**web:**
- `apps/dashboard/src/.../incidents/[id]/page.tsx` — Inconclusive UX (S4)
- `apps/dashboard/src/lib/api/<incidents>.ts` — type extension (S4)

**Reused (read-only references — do not modify):**
- `src/modules/investigation/infra/cite-evidence-tool.ts` — `cite_evidence` definition (already validates quote-substring, line 107)
- `src/modules/triage/domain/evidence.repository.ts` — Evidence type / repo interface (already exposes `findByIncident`)

---

## Notes & Risks

- **Single re-invocation, not infinite loop** — the gate re-invokes the agent at most once. If the LLM ignored cite_evidence twice in a row, we accept the inconclusive outcome rather than burning unbounded retries. This bounds worst-case cost at 2 agent runs + 0 synthesis calls (vs current 1 agent run + 3 wasted synthesis calls).
- **Persisted state migration** — adding `outcome` to existing ElectroDB entity is non-breaking (new optional attribute). No data migration required; reads of legacy records default `outcome` to `'completed'` if status was `completed`, `'failed'` if status was `failed`. Spell out in S2.
- **Removing fallback is intentional and irreversible** — once shipped, an investigation that previously would have produced (degraded) findings will instead show as `inconclusive`. The diagnostic report from S1 will tell us how many recent incidents this affects so we can communicate to active users.
- **No relay-repo changes** — relay is not involved in synthesis or evidence. Deploy chain for this PRD: `core` then `web`.

---

## Build Candidate Tag

After all four sprint specs + `progress.json` + `INVARIANTS.md` are written and validated:
```bash
git tag build-candidate/evidence-required-no-fallback
```

`/plan-build-test` in the next session will detect this tag and skip re-discovery.
