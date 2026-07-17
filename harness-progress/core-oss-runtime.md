# core-oss-runtime workflow journal

## 2026-07-17T11:06:38.896Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-011
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T11:07:49.756Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-011
- AcceptanceChecks: AC-011
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/974971fa-5aa7-49ba-a1c3-5ac920b07614/core-oss-runtime/WI-AC-011-1-integration_qa-ea1d4b69c6348077.log
- NextAction: next Ready Work Item

## 2026-07-17T11:28:19.419Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-018
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T11:28:55.491Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-018
- AcceptanceChecks: AC-018
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/8e822405-884a-4bba-a2f4-4b9351c05a16/core-oss-runtime/WI-AC-018-1-integration_qa-c547e750c2b81ae8.log
- NextAction: next Ready Work Item

## 2026-07-17T21:13:38.965Z — Resumed

- WorkItem: WI-AC-018
- PreviousPhase: qa
- Attempt: 2
- NextAction: qa

## 2026-07-17T21:13:38.982Z — Operator guidance

- WorkItem: WI-AC-018
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: Goal Review failed on AC-018 (evidence: .git/harness-evidence/root/72767d26-762e-4586-b46c-ec024ac5644d/goal-review/goal-1-goal_review-d7a9251a04c2b13e.log + .harness/goal-review-probes.json). Repair Plan — implement coding (NOT VERIFY-FIRST / zero-diff).

expected: when active Investigation LLM fails, Core follows fallbackProfileId to a healthy Ornith profile and investigation proceeds (or, if chain exhausted, fails closed with a clear configure/fix-LLM error)
observed: active bad baseUrl + fallbackProfileId → host.docker.internal:8081/v1 still yields incident status=failed within ~1s with empty evidenceByAgent; api logs show local-llm.chat.completions.structured failed then CircuitBreakerOpenError for subsequent chain hops (shared local-llm breaker opens after active hop and blocks remaining fallbacks). Incidents 25b50a3e / 04b460ab. Good-only Ornith succeeds after cooldown.

Root cause: OpenAiCompatibleLlmClient walks the fallbackProfileId chain but wraps every hop in one shared CircuitBreaker (bootstrap/investigation-worker registerOssLlmCircuitBreaker). Active endpoint failure opens the breaker; later hops never reach Ornith.

Fix requirements:
1. Circuit breaker must be per-endpoint (or per profileId/baseUrl), not one global local-llm breaker across the fallback chain — a failed active must not CircuitBreakerOpenError healthy fallbacks.
2. Keep fail-closed when the entire chain is exhausted with a clear configure/fix-LLM error (no DeterministicLLMClient/Anthropic silent success).
3. Unit + runtime proof: bad active + healthy Ornith fallbackProfileId → investigation proceeds (or clear chain-exhausted error). Rebuild compose api/worker images; do not claim green from grep-only IV.
4. Leave AC-025/026 Ornith host.docker.internal presets alone unless a real regression appears.
- NextAction: Coding

## 2026-07-17T21:14:06.545Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-018
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T21:14:17.037Z — Integrated Verification defect

- Attempt: 2/3
- WorkItem: WI-AC-018
- Defects: Integrated Verification failed
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/135fe572-c9b5-4da0-b8ca-4c20846ce901/core-oss-runtime/WI-AC-018-2-integration_qa-e3b0c44298fc1c14.log
- NextAction: Repair Plan

## 2026-07-17T21:14:18.440Z — Resumed

- WorkItem: WI-AC-018
- PreviousPhase: repair_plan
- Attempt: 2
- NextAction: repair-plan

## 2026-07-17T21:14:18.459Z — Operator guidance

- WorkItem: WI-AC-018
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: CRITICAL: ledger was falsely implementation=true after Goal Review reopen — you MUST start at CODING (implement Repair Plan). Do NOT resume at QA. Do NOT emit implementation:true until the shared local-llm circuit breaker no longer blocks fallbackProfileId hops after an active failure.

Goal Review failed on AC-018 (evidence: .git/harness-evidence/root/72767d26-762e-4586-b46c-ec024ac5644d/goal-review/goal-1-goal_review-d7a9251a04c2b13e.log + .harness/goal-review-probes.json). Repair Plan — implement coding (NOT VERIFY-FIRST / zero-diff).

expected: when active Investigation LLM fails, Core follows fallbackProfileId to a healthy Ornith profile and investigation proceeds (or, if chain exhausted, fails closed with a clear configure/fix-LLM error)
observed: active bad baseUrl + fallbackProfileId → host.docker.internal:8081/v1 still yields incident status=failed within ~1s with empty evidenceByAgent; api logs show local-llm.chat.completions.structured failed then CircuitBreakerOpenError for subsequent chain hops (shared local-llm breaker opens after active hop and blocks remaining fallbacks). Incidents 25b50a3e / 04b460ab. Good-only Ornith succeeds after cooldown.

Root cause: OpenAiCompatibleLlmClient walks the fallbackProfileId chain but wraps every hop in one shared CircuitBreaker (bootstrap/investigation-worker registerOssLlmCircuitBreaker). Active endpoint failure opens the breaker; later hops never reach Ornith.

Fix requirements:
1. Circuit breaker must be per-endpoint (or per profileId/baseUrl), not one global local-llm breaker across the fallback chain — a failed active must not CircuitBreakerOpenError healthy fallbacks.
2. Keep fail-closed when the entire chain is exhausted with a clear configure/fix-LLM error (no DeterministicLLMClient/Anthropic silent success).
3. Unit + runtime proof: bad active + healthy Ornith fallbackProfileId → investigation proceeds (or clear chain-exhausted error). Rebuild compose api/worker images; do not claim green from grep-only IV.
4. Leave AC-025/026 Ornith host.docker.internal presets alone unless a real regression appears.
- NextAction: Coding

## 2026-07-17T21:23:28.125Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-018
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T21:23:28.561Z — Blocked Work Item

- Attempt: 2/3
- WorkItem: WI-AC-018
- Outcome: integration could not complete
- Defects: error: Your local changes to the following files would be overwritten by merge:
	.harness/wi-ac-018-verify-first.json
Please commit your changes or stash them before you merge.
Aborting
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-17T21:23:32.131Z — Explicit Resume

- WorkItem: WI-AC-018
- Outcome: user authorized a new Attempt cycle
- Guidance: Auto-retry: MERGE/IV ONLY after isolated QA already passed. Do NOT re-implement, do NOT re-run verify-first coding, do NOT burn a coding Attempt. Proceed to Checkpoint merge into the plan integration branch, then Integrated Verification. If .git/index.lock exists, wait and retry the merge — merge-lock noise is not a product defect.
Evidence excerpt: {
  "id": "WI-AC-018",
  "qa": true,
  "implementation": true,
  "defects": []
}
- NextAction: Coding Attempt 1

## 2026-07-17T21:23:32.149Z — Operator guidance

- WorkItem: WI-AC-018
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: Auto-retry: MERGE/IV ONLY after isolated QA already passed. Do NOT re-implement, do NOT re-run verify-first coding, do NOT burn a coding Attempt. Proceed to Checkpoint merge into the plan integration branch, then Integrated Verification. If .git/index.lock exists, wait and retry the merge — merge-lock noise is not a product defect.
Evidence excerpt: {
  "id": "WI-AC-018",
  "qa": true,
  "implementation": true,
  "defects": []
}
- NextAction: Coding

## 2026-07-17T21:25:12.462Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-018
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T21:29:02.908Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-018
- AcceptanceChecks: AC-018
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/54e1113e-084c-4ec7-9b31-411be81b453f/core-oss-runtime/WI-AC-018-1-integration_qa-c547e750c2b81ae8.log
- NextAction: next Ready Work Item

## 2026-07-17T21:42:00.794Z — Operator guidance

- WorkItem: WI-AC-018
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: Goal Review evidence (AC-018) — product repair in core-oss-runtime; NOT WI-AC-025 (golden path already passes). Prior MERGE/IV-only + grep green is insufficient.
expected: when active Investigation LLM fails, Core follows fallbackProfileId to a healthy Ornith profile and investigation proceeds (or, if chain exhausted, fails closed with a clear configure/fix-LLM error); do NOT silently succeed via DeterministicLLMClient/Anthropic.
observed: active bad baseUrl http://127.0.0.1:1/v1 + fallbackProfileId → http://host.docker.internal:8081/v1 still yields incident status=failed with empty evidenceByAgent while good-only Ornith completes (AC-025); api logs show local-llm.chat.completions.structured failed then CircuitBreakerOpenError for subsequent chain hops (incidents f7289013-1983-4764-a7e2-21a95eecf0ae / 679c473d-99d3-4132-95ba-fe259fd63dca); evidence .harness/goal-review-ac018-strict.json + docker logs causeflow-api.
Fix: shared local-llm circuit breaker must NOT block fallbackProfileId hops to a different healthy endpoint/profile — use per-endpoint (or per-profile) breakers; prove with the same runtime probe GR used (strict AC-018), not grep-only. Forbid verify-first zero-diff pass. Implement coding (Repair Plan), then QA/IV, then Goal Review.
- NextAction: Coding
