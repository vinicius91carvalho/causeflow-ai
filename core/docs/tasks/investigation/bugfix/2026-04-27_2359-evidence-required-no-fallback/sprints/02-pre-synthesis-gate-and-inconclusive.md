# Sprint 02 — Pre-Synthesis Gate + Inconclusive Terminal State

**Repo:** core (`/root/projects/causeflow/core/`)
**Estimated work:** 90–120 min
**Depends on:** Sprint 01 (informational; not a hard block)
**Blocks:** Sprint 03, Sprint 04
**Branch:** `sprint/02-pre-synthesis-gate-and-inconclusive`

## Goal

Make it structurally impossible for synthesis to run with zero Evidence records. Replace the silent unvalidated-fallback path with a clean `inconclusive` terminal state, gated by a pre-synthesis evidence check and a single bounded re-invocation of the orchestrator agent.

## Background

Today, when `evidences.length === 0` at synthesis time, `investigate-incident.usecase.ts` makes 3 LLM attempts that are mathematically guaranteed to fail (the schema requires `evidenceIds.min(1)`, and there are no IDs to cite). It then falls back to fabricating `findings` with `evidenceIds: []` and `recommendedActions: []`, persists the result, and exits as `completed`. Users see fake findings.

The fix is a deterministic gate: count evidences before the retry loop. If zero, re-invoke the orchestrator agent once with a strict continuation prompt. If still zero after re-invocation, mark `status='inconclusive'`, persist a `resolution` reason, publish an `investigation.inconclusive` SQS event, and return — never call synthesis.

## Tasks

### 1. Extend `IncidentStatus` enum with `'inconclusive'`

**File:** `src/shared/domain/types.ts:4`

Add `'inconclusive'` to the union:
```ts
export type IncidentStatus = 'open' | 'triaging' | 'investigating' | 'awaiting_approval' | 'remediating' | 'resolved' | 'closed' | 'aborted' | 'failed' | 'inconclusive';
```

**File:** `src/shared/infra/db/entities/IncidentEntity.ts:12`

Mirror in the ElectroDB attribute:
```ts
status: { type: ['open', 'triaging', 'investigating', 'awaiting_approval', 'remediating', 'resolved', 'closed', 'aborted', 'failed', 'inconclusive'], required: true, default: 'open' },
```

**File:** `src/modules/ingestion/infra/incident.routes.ts:26`

Mirror in the Zod input validation enum (if the field is exposed for write).

### 2. Resolve TypeScript narrowing errors

After the enum change, run `pnpm typecheck`. Every `switch (status)` statement and any narrowed type guard becomes potentially non-exhaustive. Fix each compile error:
- For modules that don't care about `inconclusive` (notification, audit, etc.): treat it like `completed` for display, or fall through to a default branch. Add a one-line comment explaining the choice.
- For the worker (`src/workers/investigation-worker.ts`): handle `inconclusive` explicitly in any status-conditional logic (publish the right SQS event, do not refund — see PRD §8 Out of Scope).

### 3. Pre-synthesis gate in `investigate-incident.usecase.ts`

**File:** `src/modules/investigation/application/investigate-incident.usecase.ts`

Locate the call to `synthesizeWithValidation` (in the orchestrator-mode branch — currently around the lines that immediately precede the existing fallback at 1424). Before the call:

```ts
// Pre-synthesis gate: synthesis cannot run with zero evidences (schema requires evidenceIds.min(1)).
let evidences = await this.evidenceRepo.findByIncident(tenantId, incidentId);

if (evidences.length === 0) {
    logger.warn({
        incidentId,
        tenantId,
        agentReportedFindings: orchestratorResult.findings.length,
        toolCalls: rawToolCalls.length,
        event: 'pre_synthesis_zero_evidence',
    }, 'Pre-synthesis gate: 0 evidences after agent run, re-invoking orchestrator');

    // Re-invoke orchestrator with strict continuation prompt — bounded to ONE retry.
    orchestratorResult = await this.runOrchestratorAgent({
        tenantId,
        incidentId,
        // continuation prompt added; full constant defined alongside the use case or in agent-configs.ts
        continuationPrompt: ORCHESTRATOR_REINVOCATION_PROMPT,
        previousResult: orchestratorResult,
    });
    evidences = await this.evidenceRepo.findByIncident(tenantId, incidentId);

    if (evidences.length === 0) {
        // Terminal: agent could not cite evidence even after re-invocation. Mark inconclusive; do NOT call synthesis.
        return await this.terminateInconclusive({
            tenantId,
            incidentId,
            reason: 'agent_failed_to_cite_evidence_after_reinvocation',
            costAccrued: totalCost,
            channel,
        });
    }
}
```

The exact mechanics for `runOrchestratorAgent` (re-invocation) depend on how the agent is invoked today. Review the orchestrator invocation block (between the `"Orchestrator agent starting"` and `"Orchestrator agent completed"` log lines) and extract a callable that accepts a `continuationPrompt`. If the existing code does not support continuation, the re-invocation can be a fresh agent run with the strict prompt — that is acceptable; correctness > minimal diff.

Define `ORCHESTRATOR_REINVOCATION_PROMPT` as a module-level constant. Suggested content:

```
You produced findings WITHOUT calling cite_evidence. This is a contract violation.

Re-do the investigation. For EVERY claim you make, you MUST first call cite_evidence
with the supporting tool output (specifying toolCallId, claim text, and a verbatim quote
from the tool output). 

If after exhaustive tool use you cannot find supporting evidence, terminate WITHOUT
producing findings. There is no fallback. Un-cited findings will be discarded and the
investigation marked inconclusive.

Do not produce a finding without a corresponding cite_evidence call.
```

### 4. Implement `terminateInconclusive`

Add a private method to the use case:

```ts
private async terminateInconclusive(params: {
    tenantId: TenantId;
    incidentId: IncidentId;
    reason: string;
    costAccrued: number;
    channel?: ProgressChannel;
}): Promise<void> {
    logger.warn({
        incidentId: params.incidentId,
        tenantId: params.tenantId,
        reason: params.reason,
        costAccrued: params.costAccrued,
    }, 'Investigation marked inconclusive — agent failed to cite evidence after re-invocation');

    await this.incidentRepo.update(params.tenantId, params.incidentId, {
        status: 'inconclusive',
        resolution: `inconclusive: ${params.reason}`,
        totalCostUsd: params.costAccrued,
    });

    await this.eventBus.publish({
        eventType: 'investigation.inconclusive',
        occurredAt: new Date().toISOString(),
        tenantId: params.tenantId,
        payload: { incidentId: params.incidentId, reason: params.reason },
    });

    params.channel?.sendProgress({
        stage: 'inconclusive',
        message: 'Investigation completed without sufficient evidence. Marked inconclusive.',
    });
}
```

### 5. Remove the unvalidated-fallback branch

**File:** `src/modules/investigation/application/investigate-incident.usecase.ts:1424-1431`

Delete the catch block:
```ts
} catch (err) {
    logger.warn({ err, incidentId }, 'Synthesis with citation failed — falling back to unvalidated orchestrator findings');
    investigationResult = { findings: stringsToFindings(orchestratorResult.findings), ... };
}
```

Replace with: route to `terminateInconclusive` (with reason `'synthesis_exhausted_with_invalid_citations'`) — this happens when the LLM kept citing unknown evidenceIds across all 3 retries despite evidence being available. Same terminal as the zero-evidence case.

### 6. Remove or scope `stringsToFindings`

**File:** `src/modules/investigation/application/investigate-incident.usecase.ts:98`

The only caller was the deleted fallback. Either delete the function entirely, or move it to a `__test-fixtures__` directory if test code uses it. Confirm with `grep -n stringsToFindings src/ tests/`.

### 7. Worker handling of `inconclusive`

**File:** `src/workers/investigation-worker.ts`

The worker today handles `completed` and `failed` SQS publish branches. Add an `inconclusive` branch after the use case returns: if the incident is now `status='inconclusive'`, publish `investigation.inconclusive` to the progress queue (the use case already publishes via EventBus; ensure the EventBus → SQS bridge handles the new event type — search for the bridge in `bootstrap.ts` and add `investigation.inconclusive` to the routed event types).

Do **not** call `refundInvestigation.execute(tid)` for inconclusive — see PRD §8.

### 8. Tests

**Unit (`tests/unit/modules/investigation/`):**
- `investigate-incident-pre-synthesis-gate.test.ts`:
  - Stub agent with 0 evidences after run → asserts re-invocation occurs, gate logs `pre_synthesis_zero_evidence`.
  - Stub agent with 0 evidences after run, then 2 evidences after re-invocation → asserts synthesis is called and succeeds.
  - Stub agent with 0 evidences after both runs → asserts `terminateInconclusive` is called, synthesis NEVER invoked, `status='inconclusive'` persisted.
  - Stub synthesis exhausting all 3 retries with invalid evidenceId citations → asserts `terminateInconclusive` is called.

**Integration (`tests/integration/modules/investigation/`):**
- `investigation-inconclusive-flow.test.ts` (uses LocalStack DynamoDB):
  - Full use case execution with stubbed LLM → asserts persisted record has `status='inconclusive'` and `resolution='inconclusive: agent_failed_to_cite_evidence_after_reinvocation'`.
  - Verify SQS event `investigation.inconclusive` was published (LocalStack SQS).
- Existing happy-path test in the same area continues to pass (no regression).

### 9. INVARIANTS.md (project-level)

Append three new invariants `I9`, `I10`, `I11` to `core/INVARIANTS.md` (the project-root file, not the PRD-local one — that is created in step 10):

```markdown
## I9 — Synthesis never runs with zero evidences
- **Owner:** investigation
- **Invariant:** `investigate-incident.usecase.ts` MUST count evidences before invoking `synthesizeWithValidation`. If zero, the agent is re-invoked once; if still zero, the investigation terminates as `inconclusive` and synthesis is NOT called.
- **Verify:** `grep -nE "Pre-synthesis gate|pre_synthesis_zero_evidence" src/modules/investigation/application/investigate-incident.usecase.ts | grep -q . && exit 0 || exit 1`
- **Fix:** Insert the pre-synthesis gate before any call to `synthesizeWithValidation`. See PRD `2026-04-27_2359-evidence-required-no-fallback/`.

## I10 — No fabricated unvalidated findings
- **Owner:** investigation
- **Invariant:** No production code path constructs an `InvestigationResult` with `findings` having `evidenceIds: []`. The unvalidated-fallback branch must not exist.
- **Verify:** `! grep -rn 'Synthesis with citation failed — falling back' src/ --include='*.ts' | grep -q .`
- **Fix:** Delete the catch-block fallback in `investigate-incident.usecase.ts`. Route exhausted-citation cases to `terminateInconclusive`.

## I11 — Inconclusive outcome is persisted and emitted
- **Owner:** investigation
- **Invariant:** When an investigation terminates as `status='inconclusive'`, the DB record MUST include the `inconclusive` status and a `resolution` string starting with `'inconclusive:'`. The worker MUST publish an `investigation.inconclusive` SQS event before exiting.
- **Verify:** Integration test `tests/integration/modules/investigation/investigation-inconclusive-flow.test.ts` asserts both conditions.
- **Fix:** Use `terminateInconclusive` from `investigate-incident.usecase.ts` for all inconclusive paths.
```

Update `infra/scripts/check-invariants.ts` (or wherever `pnpm lint-invariants` runs) to include the new checks.

### 10. PRD-local INVARIANTS.md

Mirror `I9–I11` into `docs/tasks/investigation/bugfix/2026-04-27_2359-evidence-required-no-fallback/INVARIANTS.md` so the PRD's contracts are self-contained for the next sprint executor (already created in PRD setup; just confirm the content matches).

## Files

**files_to_create:**
- `tests/unit/modules/investigation/investigate-incident-pre-synthesis-gate.test.ts`
- `tests/integration/modules/investigation/investigation-inconclusive-flow.test.ts`

**files_to_modify:**
- `src/shared/domain/types.ts`
- `src/shared/infra/db/entities/IncidentEntity.ts`
- `src/modules/ingestion/infra/incident.routes.ts` (only if it carries the status enum in a Zod validator)
- `src/modules/investigation/application/investigate-incident.usecase.ts`
- `src/workers/investigation-worker.ts`
- `src/bootstrap.ts` (only if EventBus → SQS bridge needs the new event type added)
- `INVARIANTS.md` (project root)
- `infra/scripts/check-invariants.ts` (or equivalent invariant runner)

**files_read_only:**
- `src/modules/triage/domain/evidence.repository.ts`
- `src/modules/investigation/infra/cite-evidence-tool.ts`
- `src/modules/ingestion/domain/incident.entity.ts`
- `src/modules/investigation/application/agent-configs.ts` (for reference; modified in Sprint 03)

**shared_contracts:**
- `src/shared/domain/types.ts` — IncidentStatus enum gains `'inconclusive'`. Consumed by all modules that switch on status; downstream impact handled in step 2.
- `src/bootstrap.ts` — new SQS event type `investigation.inconclusive` routed by the EventBus → SQS bridge.

## Acceptance

- `pnpm typecheck` clean (all narrowing errors resolved).
- `pnpm test:run` green (unit tests for the gate, terminal, and re-invocation paths pass).
- `pnpm test:integration` green (LocalStack-backed integration test asserts persisted `inconclusive` and SQS event).
- `pnpm lint-invariants` green (new I9–I11 checks pass).
- Code search confirms removal: `grep -rn 'Synthesis with citation failed — falling back' src/` returns 0 hits; `grep -rn 'stringsToFindings' src/` returns 0 hits (or only test fixtures).
- Manual: a re-run of an investigation similar to incident `3e2da7ae...` on staging terminates as `inconclusive` (verified via DynamoDB query) within ≤2 agent runs and 0 synthesis calls (verified via cost breakdown).

## Notes

- Cost guard: in worst case (re-invocation still produces 0 evidences), this sprint's behavior costs ~2× orchestrator agent runs. This is bounded and intentional. Track via `totalCostUsd` field which already exists.
- The `'inconclusive'` enum addition is a TypeScript narrowing event. Allow ~30 min for fixing all narrow-type compile errors across modules.
