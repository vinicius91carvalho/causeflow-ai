# PRD: Investigation Evidence Required — No Fallback

**Status:** Approved 2026-04-27 — pending execution via `/plan-build-test` in a fresh session.
**Mode:** PRD + Sprint (cross-repo: `core` + `web/apps/dashboard`, 4 sprints).
**Source plan:** `/root/.claude/plans/an-error-occurred-with-polymorphic-ladybug.md` (this is the materialized PRD with execution metadata).

---

## Cross-repo coordination

Per `/root/projects/causeflow/CLAUDE.md`: this PRD spans **two independent git repos**. Coordinate by deploy order:

1. `core/` — Sprints 01 (report only), 02, 03, partial 04 (API surface).
2. `web/apps/dashboard/` — partial Sprint 04 (Inconclusive UX + types).

Two PRs total: one to `core`, one to `web`. Deploy `core` first; then `web`.

---

## 1. What & Why

**Problem.** The CauseFlow investigation pipeline is silently producing degraded output for an unknown number of incidents per day. Concretely: when the orchestrator agent (driving Scout → Foundational → Analysts → Synthesis) fails to call the `cite_evidence` tool during its run, **zero Evidence records exist** when synthesis is invoked. The synthesis schema (`investigate-incident.usecase.ts:181`) requires `evidenceIds.min(1)` per finding — impossible to satisfy without evidence. The retry loop attempts synthesis 3× anyway (wasting Sonnet calls), exhausts, and the catch block falls back to fabricating `findings` with `evidenceIds: []` and `recommendedActions: []`. The dashboard then renders the incident as completed-but-broken: an "error occurred" experience with no actions, no real findings, but no clear failure signal either.

The reported failing incident is `3e2da7ae-3491-47f4-a3eb-69374b885c5a` (tenant `org_3CIe2PY6G6xwnUu9TA0oopGUW9u`), staging. CloudWatch trace (log group `/ecs/causeflow-staging-worker`, filter pattern `"3e2da7ae-3491-47f4-a3eb-69374b885c5a"`) shows the exact 3-attempt synthesis failure → fallback sequence.

**Desired Outcome.** Synthesis NEVER runs with zero evidences. The orchestrator agent is given exactly one chance to retry (re-invoked with a strict continuation prompt) if it forgets to cite evidence. After that, the investigation terminates as `inconclusive` (clean terminal state, no fake findings, no wasted LLM cost). The dashboard surfaces `inconclusive` as a distinct, actionable state — not a generic error.

**Justification.**
- **Trust** — fake findings undermine user trust in the AI SRE product. The user explicitly stated: *"O ideal é sempre o agente gerar evidências se chegou a uma conclusão. Caso não encontrou uma conclusão, ele deve continuar procurando. Ele não pode chegar a uma síntese sem evidência nenhuma."*
- **Cost** — every fallback today burns ~3 Sonnet synthesis calls that are guaranteed to fail. Eliminating the impossible-retry path saves money on every degraded investigation.
- **Regression** — the failure mode was introduced by commit `d3d0771` (Apr 17, 2026) which added the `min(1)` evidence-citation contract. Before that, findings were `z.array(z.string())` and the failure mode could not occur. The contract is correct; the missing piece is the gate that enforces it upstream of synthesis.
- **Observability** — replacing the silent fallback with an explicit `inconclusive` state lets us measure orchestrator-agent reliability over time.

---

## 2. Correctness Contract

**Audience.** SRE end-users viewing investigation results in `dashboard-staging.causeflow.ai` and `dashboard.causeflow.ai`. They make decisions about whether to trust the AI's diagnosis, take recommended actions, or escalate to human review.

**Failure Definition.** An investigation result is "useless" if it is rendered as `completed` but contains findings without supporting evidence — the user cannot tell whether the AI reached a conclusion, fabricated one, or failed silently.

**Danger Definition.** An investigation result is "harmful" if it presents fabricated findings (e.g. `[orchestrator_finding] "the database is overloaded"`) to a user who then takes irreversible remediation action based on a claim with zero evidence.

**Risk Tolerance.** A confident-wrong answer is **far worse** than an explicit "inconclusive" refusal. The user has stated this directly. We accept the tradeoff that some investigations that previously produced (degraded) findings will instead produce no findings — Sprint 01's diagnostic report quantifies this.

---

## 3. Context Loaded

- `core/CLAUDE.md` — modular monolith, 15 modules, Clean Architecture (Infra → Application → Domain), pnpm only, model routing for AI agents, ~$0.70/investigation target.
- `parent CLAUDE.md` (`/root/projects/causeflow/CLAUDE.md`) — five sibling repos, deploy order `relay → core → web`, cross-repo PRDs go in the first repo of the deploy chain.
- `core/INVARIANTS.md` — existing I1–I8 invariants enforced by `pnpm lint-invariants`. Confirmed: `IncidentStatus` enum lives in `src/shared/domain/types.ts:4` and already includes `'aborted'`/`'failed'`. Adding `'inconclusive'` follows the same pattern.
- `core/src/modules/investigation/application/investigate-incident.usecase.ts` (93KB) — main orchestration; lines 178-201 (synthesis Zod schema), 336-396 (synthesis retry loop), 1424-1431 (fallback path), 87-118 (evidence helper functions).
- `core/src/modules/investigation/application/agent-configs.ts:367-479` — `ORCHESTRATOR_SYSTEM_PROMPT`. Already declares cite_evidence "MANDATORY" but agent ignored it on incident `3e2da7ae...`. Strengthening alone is insufficient.
- `core/src/modules/investigation/infra/cite-evidence-tool.ts` — `cite_evidence` tool definition; already validates that `quote` is a literal substring of actual tool output (line 107). No change needed.
- `core/src/modules/triage/domain/evidence.repository.ts` — `IEvidenceRepository.findByIncident(tenantId, incidentId)` returns `Evidence[]`. Used unchanged.
- `core/src/modules/ingestion/domain/incident.entity.ts` — `Incident` interface with `status: IncidentStatus`. Need to add no new field; the new `'inconclusive'` enum value carries the meaning.
- `core/src/shared/infra/db/entities/IncidentEntity.ts:12` — ElectroDB entity declares the same status enum. Must be extended in lockstep.
- Existing PRD reference: `docs/tasks/integration/bugfix/2026-04-27_1530-integration-hardening/` — same structure (spec.md, progress.json, INVARIANTS.md, sprints/), used as template.

---

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| `% investigations hitting synthesis fallback` (per CloudWatch `"Synthesis with citation failed"`) | TBD by Sprint 01 | **0** post-deploy | CloudWatch Insights query against `/ecs/causeflow-staging-worker` and `/ecs/causeflow-production-worker` for the 7 days post-deploy |
| `% investigations terminating as inconclusive` | n/a (state doesn't exist) | report-only baseline within first 7 days | Count of `outcome=inconclusive` records in DynamoDB |
| Wasted synthesis LLM calls per failed investigation | 3 Sonnet calls | 0 | Code review + telemetry: no `'Synthesis attempt failed'` logs when `evidences.length === 0` pre-check fails |
| Orchestrator-agent cite-rate (calls `cite_evidence` ≥1x per run) | TBD by Sprint 01 | ≥95% within 14 days post-deploy | `event=orchestrator_failed_to_cite` log lines per total investigation runs |
| Dashboard E2E coverage of inconclusive state | 0 tests | 1 Playwright test | `pnpm test:e2e` in `web` |

---

## 5. Architecture Decisions

### AD-1: Extend `IncidentStatus` enum with `'inconclusive'` (do NOT add a separate `outcome` field)

The existing `IncidentStatus` enum in `src/shared/domain/types.ts` already encompasses terminal states (`resolved`, `closed`, `aborted`, `failed`). Adding a separate `outcome` field would duplicate the concept and require migrating downstream consumers (notification module, audit module, etc.) to read both fields. Adding `'inconclusive'` to the existing enum is the lower-risk, idiomatic choice. ElectroDB will treat new records identically to existing ones; legacy records (no `'inconclusive'` value persisted) are unaffected.

### AD-2: Pre-synthesis gate is the source of truth, not the prompt

The orchestrator's system prompt already declares cite_evidence MANDATORY (`agent-configs.ts:443-458`). The reported incident proves prompt-only enforcement is unreliable. The pre-synthesis gate in `investigate-incident.usecase.ts` is the deterministic enforcement point — it runs unconditionally regardless of LLM behavior. Sprint 03's prompt hardening is supplementary (reduces re-invocation rate); the gate (Sprint 02) is the load-bearing fix.

### AD-3: Single bounded re-invocation, not unbounded retry

If `evidences.length === 0` after the first agent run, the orchestrator agent is re-invoked **once** with a strict continuation prompt. After that, if still zero evidences, the investigation is marked `inconclusive`. Worst-case cost: 2 agent runs + 0 synthesis calls (vs current 1 agent run + 3 wasted synthesis calls). Bounding at 1 retry prevents runaway cost while giving the LLM a meaningful second chance.

### AD-4: Remove the unvalidated-fallback branch entirely

The catch block at `investigate-incident.usecase.ts:1424-1431` (`'Synthesis with citation failed — falling back to unvalidated orchestrator findings'`) is removed in production code. The only path for "synthesis failed" is now `outcome=inconclusive`. The `stringsToFindings` helper (line 98) is removed or scoped to test fixtures only. This is intentional and irreversible — once shipped, an incident that previously would have produced fabricated findings will produce none.

### AD-5: Dashboard differentiates `inconclusive` from `failed` visually

`failed` (red) means the system crashed or could not run the investigation at all (timeout, infra error, refund issued). `inconclusive` (amber/yellow) means the system ran successfully but the agent could not find supporting evidence. These are semantically different and must look different in the dashboard, with copy that helps the user decide what to do next (provide more context, broaden scope, escalate).

---

## 6. Security Boundaries

- **No new attack surface.** No new HTTP endpoints, no new auth paths, no new secrets. The new `'inconclusive'` enum value is internal state.
- **Tenant isolation preserved.** All evidence/incident reads continue to use `(tenantId, incidentId)` keys; no cross-tenant leakage possible.
- **No PII in logs.** New telemetry log line `event=orchestrator_failed_to_cite` includes `incidentId`, `agentReportedFindings.length`, `evidences.length`, `toolCalls.length` — all already present in existing logs. No additional PII.
- **No prompt injection risk.** The continuation prompt sent to the agent during re-invocation is constructed from internal constants only — no user input is interpolated.

---

## 7. Data Model Changes

### `IncidentStatus` enum

Add `'inconclusive'` to the union in:
- `core/src/shared/domain/types.ts:4`
- `core/src/shared/infra/db/entities/IncidentEntity.ts:12` (ElectroDB attribute)
- `core/src/modules/ingestion/infra/incident.routes.ts:26` (input validation Zod enum, if applicable)

No data migration required. New status is additive; existing records retain their current value.

### Optional persisted reason (no schema change)

The reason for landing in `inconclusive` (e.g. `"agent_failed_to_cite_evidence_after_reinvocation"`) is logged but not persisted in a new DB column. The investigation use case already has a `resolution?: string` field on the `Incident` entity (line 30 of `incident.entity.ts`); reuse it: when `status='inconclusive'`, set `resolution = 'inconclusive: <reason>'`. No migration needed.

---

## 8. Out of Scope (Explicit)

- **Hypothesis / Debate modes.** The bug is observed in `mode=orchestrator`. Hypothesis and Debate modes already create evidence inline (per prior exploration of `modes/hypothesis/` and `modes/debate/`). They are not modified by this PRD.
- **Triage module.** Triage runs before investigation and may or may not produce its own evidence. This PRD does not change triage. The pre-synthesis gate counts evidences regardless of provenance.
- **Verification / Falsification agents.** These run after synthesis and produce their own evidence (`agent_reasoning` type). Not modified.
- **Notification module.** Slack/email notifications about the new `inconclusive` status are NOT added in this PRD. They can be added in a follow-up. Today, the inconclusive state will be visible in the dashboard but won't trigger notifications.
- **Refund logic.** Currently, only `failed` investigations are refunded (`refundInvestigation` in `investigation-worker.ts`). Whether `inconclusive` should also refund is a billing decision, deferred. For now: do NOT refund on inconclusive — the investigation ran (cost incurred), it just didn't reach a conclusion.

---

## 9. Sprint Decomposition

| Sprint | Title | Repo | Depends On | Batch | Model |
|--------|-------|------|------------|-------|-------|
| 1 | Diagnostic & Quantification | core (report only) | — | 1 | sonnet |
| 2 | Pre-Synthesis Gate + Inconclusive Terminal | core | 1 | 2 | sonnet |
| 3 | Orchestrator Prompt Hardening + Telemetry | core | 2 | 3 | sonnet |
| 4 | API Surface + Dashboard Inconclusive UX | core + web | 2 | 3 | sonnet |

Sprints 03 and 04 share batch 3 — they touch different files (S3: `agent-configs.ts` + telemetry add; S4: routes + web app) and can run in parallel after S2 lands.

Sprint specs in `sprints/`:
- `01-diagnostic-quantification.md`
- `02-pre-synthesis-gate-and-inconclusive.md`
- `03-orchestrator-prompt-hardening.md`
- `04-api-and-dashboard-inconclusive-ux.md`

Progress tracked in `progress.json`. Cross-cutting contracts in `INVARIANTS.md` (sibling file).

---

## 10. Verification (End-to-End)

After all four sprints land and both repos deploy to staging:

1. **Reproduce original failure scenario.** Trigger an investigation on staging with sparse/ambiguous evidence (similar conditions to incident `3e2da7ae...`). Expected: investigation terminates with `status='inconclusive'` after at most 2 agent runs; **no** `"Synthesis attempt failed"` lines in CloudWatch; **no** `"Synthesis with citation failed — falling back to unvalidated orchestrator findings"` in CloudWatch.
2. **Re-run diagnostic CloudWatch query** (the one from Sprint 01) for the 24h window post-deploy. Expected: count of `"Synthesis with citation failed"` is 0.
3. **Dashboard visual check.** Open the original incident URL `dashboard-staging.causeflow.ai/dashboard/incidents/3e2da7ae-3491-47f4-a3eb-69374b885c5a` (or a freshly-triggered inconclusive incident). Expected: amber/yellow "Inconclusive" badge with explanation text and suggested next steps. Visually distinct from completed (green) and failed (red) incidents.
4. **Cost spot-check** (from Langfuse traces or cost breakdown field): an inconclusive investigation should report 0 `synthesis` cost (the synthesis call was never made).
5. **Test suites green.** `cd core && pnpm test:run && pnpm test:integration && pnpm test:eval && pnpm lint-invariants` — all pass. `cd web && pnpm test && pnpm test:e2e` — all pass.
6. **Invariant check.** `cd core && pnpm lint-invariants` reports new invariants `I9–I11` (Evidence-Required-For-Synthesis, No-Fabricated-Findings, Inconclusive-Outcome-Persisted) as enforced.

---

## 11. Notes & Risks

- **Adding `'inconclusive'` to the status enum is a TypeScript-narrowing event.** Every `switch (status)` statement in the codebase becomes potentially non-exhaustive. The build will surface these as compile errors; Sprint 02 must handle each one (typically: route to a default "show as still-in-progress or complete" branch in non-investigation modules until they explicitly handle inconclusive).
- **ElectroDB enum extension.** Adding a new value to an ElectroDB attribute enum requires updating the local DynamoDB Local schema for integration tests; no production schema migration since DynamoDB is schemaless. Sprint 02 should verify the integration test harness picks up the new value.
- **Dashboard URL parameters.** Existing dashboard routes filter incidents by status (e.g. "show all open incidents"). The new `'inconclusive'` value may appear in such filters with no UI handling — Sprint 04 must audit the incident-list page for status-filter compatibility (at minimum: don't crash if the value appears).
- **Removing the fallback is irreversible without code revert.** Once shipped, no degraded findings will be produced. We accept this; the alternative is the current trust-eroding behavior.
- **Single re-invocation cost cap.** Worst-case per investigation: 2 full orchestrator agent runs + 0 synthesis calls. The orchestrator agent is the dominant cost component (~$0.50 of the $0.70 budget). 2 runs = ~$1.00 worst-case. Acceptable for incidents that would otherwise produce fabricated output.

---

## 12. Build Candidate

After all four sprint specs + `progress.json` + `INVARIANTS.md` are written and validated:
```bash
cd /root/projects/causeflow/core
git add docs/tasks/investigation/bugfix/2026-04-27_2359-evidence-required-no-fallback/
git commit -m "docs(investigation): Build Candidate for evidence-required-no-fallback"
git tag build-candidate/evidence-required-no-fallback
```

`/plan-build-test` in the next session will detect this tag and skip re-discovery.
