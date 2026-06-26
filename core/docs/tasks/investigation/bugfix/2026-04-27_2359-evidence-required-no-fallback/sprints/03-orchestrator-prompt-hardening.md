# Sprint 03 — Orchestrator Prompt Hardening + Telemetry

**Repo:** core (`/root/projects/causeflow/core/`)
**Estimated work:** 60–75 min
**Depends on:** Sprint 02
**Blocks:** none (parallel with Sprint 04)
**Branch:** `sprint/03-orchestrator-prompt-hardening`

## Goal

Reduce the rate at which the orchestrator agent forgets to call `cite_evidence` in the first place. Add observability so we can monitor cite-rate over time. Sprint 02 made the failure mode safe; Sprint 03 makes it rare.

## Background

The current orchestrator prompt at `agent-configs.ts:443-458` already declares cite_evidence MANDATORY, yet the failing incident `3e2da7ae...` proves the LLM does not always comply. Strengthening the prompt won't fully solve the problem (Sprint 02's gate is the load-bearing fix), but every percentage-point reduction in cite-omission rate saves a re-invocation cost and improves user experience (faster results, no inconclusive outcomes for incidents that have evidence available).

## Tasks

### 1. Strengthen `ORCHESTRATOR_SYSTEM_PROMPT`

**File:** `src/modules/investigation/application/agent-configs.ts`

Locate `ORCHESTRATOR_SYSTEM_PROMPT` (lines 367-479). Replace the existing "Evidence Citation — DETERMINISTIC, NOT OPTIONAL" section (lines 443-458) with a stronger contract that includes a termination clause and a worked example. Suggested replacement (adapt to existing prose style):

```
## Evidence Citation — DETERMINISTIC, NOT OPTIONAL

Every tool output you receive starts with a header like `[toolCallId=tc_abc12345]`. That id is the deterministic reference for the exact call.

You MUST call `cite_evidence` for EVERY claim that will appear in your final answer. The system runs a deterministic gate AFTER your run: if zero `cite_evidence` calls were made, the investigation will be marked **inconclusive** and your findings will be DISCARDED. There is no fallback path.

### Correct flow (this is the ONLY acceptable pattern)

1. Call an investigative tool (e.g. `query_logs`, `get_metrics`).
2. Read the tool output. Identify a quote that supports a claim.
3. Call `cite_evidence` with: `{ toolCallId, claim, quote }`. The `quote` must be a verbatim substring of the tool output.
4. Only AFTER `cite_evidence` returns successfully, include the corresponding claim in your finding.

### What to do if you cannot find evidence

If after exhaustive use of available tools you cannot find supporting evidence for a hypothesis:
- Do NOT produce a finding for that hypothesis.
- Do NOT speculate or summarize without citation.
- If you cannot produce ANY evidence-backed finding, terminate WITHOUT findings. The system will mark the investigation as inconclusive and will NOT attempt synthesis with un-cited claims.

### Worked example

Tool output:
  [toolCallId=tc_xyz789] query_logs result:
  2026-04-27T22:14:03Z ERROR [api-server] DB connection pool exhausted (847/864 connections)

Then:
  cite_evidence({ toolCallId: "tc_xyz789", claim: "API server hit DB connection pool exhaustion", quote: "DB connection pool exhausted (847/864 connections)" })

Then (and only then):
  Finding: "API server experienced DB connection pool exhaustion at 22:14:03Z"

This is the deterministic contract. Comply with it or terminate.
```

The exact wording is at the executor's discretion; the contract must include: (a) explicit "WILL BE DISCARDED" consequence, (b) explicit "no fallback path" statement, (c) at least one worked example showing tool → cite_evidence → finding ordering.

### 2. Post-agent telemetry — `orchestrator_failed_to_cite` event

**File:** `src/modules/investigation/application/investigate-incident.usecase.ts`

After the orchestrator agent's first run completes (before the pre-synthesis gate added in Sprint 02), emit a structured warning whenever the agent ran tool calls but produced zero evidences. This gives us a per-run signal we can dashboard.

Insert (between the existing `"Orchestrator agent completed"` log and the pre-synthesis gate from Sprint 02):

```ts
const evidenceCountAfterFirstRun = await this.evidenceRepo.findByIncident(tenantId, incidentId).then(e => e.length);
const toolCallsCount = rawToolCalls.length; // already tracked
const findingsReportedByAgent = orchestratorResult.findings.length;

if (evidenceCountAfterFirstRun === 0 && toolCallsCount > 0) {
    logger.warn({
        incidentId,
        tenantId,
        agentRole: 'orchestrator',
        agentReportedFindings: findingsReportedByAgent,
        toolCalls: toolCallsCount,
        evidences: 0,
        event: 'orchestrator_failed_to_cite',
    }, 'Orchestrator agent ran tools but did not cite any evidence — will trigger re-invocation');
}
```

This `event=orchestrator_failed_to_cite` line is the metric for "cite-rate". Operations can build a CloudWatch metric filter on this event name to track over time.

### 3. Promptfoo eval — assert cite_evidence is called

**File:** `tests/eval/orchestrator-cites-evidence.yaml` (new)

Add a Promptfoo test (per project CLAUDE.md `pnpm test:eval`). The eval runs the orchestrator agent against a stubbed tool environment that returns canned log/metric data, and asserts the agent's tool-call trace contains at least one `cite_evidence` invocation.

Reference one of the existing eval files (find via `find tests/eval -name '*.yaml'`) for structure. Required assertions:
- `assert: contains-tool-call: cite_evidence`
- `assert: tool-call-count: cite_evidence >= 1`

If Promptfoo doesn't have a built-in `tool-call-count` matcher, use a custom assertion in `tests/eval/assertions/cite-evidence-called.ts`.

Wire into `pnpm test:eval` (existing harness — no new script needed if Promptfoo discovers `*.yaml` in `tests/eval/` automatically).

### 4. (Optional, time permitting) Add a soft-failure metric for re-invocation

If telemetry budget allows, also log a `orchestrator_reinvocation_succeeded` event from inside the pre-synthesis gate (Sprint 02 code) when re-invocation does produce evidence. This complements `orchestrator_failed_to_cite` and lets us measure how effective the re-invocation is.

## Files

**files_to_create:**
- `tests/eval/orchestrator-cites-evidence.yaml`
- `tests/eval/assertions/cite-evidence-called.ts` (only if needed for custom Promptfoo assertion)

**files_to_modify:**
- `src/modules/investigation/application/agent-configs.ts` — strengthen `ORCHESTRATOR_SYSTEM_PROMPT`
- `src/modules/investigation/application/investigate-incident.usecase.ts` — add `orchestrator_failed_to_cite` telemetry log

**files_read_only:**
- `src/modules/investigation/infra/cite-evidence-tool.ts`
- `src/modules/triage/domain/evidence.repository.ts`
- `tests/eval/promptfoo/triage.yaml` (for structure reference)
- `tests/eval/promptfoo/pipeline.yaml` (for structure reference)

**shared_contracts:**
- `src/modules/investigation/application/investigate-incident.usecase.ts` — emits new structured log event `orchestrator_failed_to_cite`. CloudWatch dashboards / alerts may consume.

## Acceptance

- `pnpm typecheck` clean.
- `pnpm test:run` green (no regressions).
- `pnpm test:eval` green for the new eval, run 5 consecutive times (LLM-based test; flake check).
- Manual: re-run a synthetic incident locally with `pnpm dev` and verify the orchestrator agent calls `cite_evidence` at least once in the trace (visible in Langfuse if wired).
- Search `grep -n "orchestrator_failed_to_cite" src/modules/investigation/application/investigate-incident.usecase.ts | grep -q .` returns the new log.

## Notes

- The eval is LLM-based and may flake. If it flakes >1 in 10 runs, increase the prompt strength or relax the assertion (e.g. accept "at least one tool call OR at least one cite_evidence" — the absence of any tool call is also valid termination).
- Do NOT block CI on the eval if it flakes — wire it into a separate `pnpm test:eval` invocation that runs nightly, not on every PR.
