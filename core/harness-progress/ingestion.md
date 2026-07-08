# ingestion workflow journal

## 2026-07-08T16:02:01.353Z — Resumed

- WorkItem: WI-AC-014
- PreviousPhase: claimed
- Attempt: 1
- NextAction: start-orchestrator

## 2026-07-08T16:05:21.908Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-014
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations","provider_name":"Venice","is_byok":false,"retry_after_seconds":16,"retry_after_seconds_raw":15.751,"headers":{"Retry-After":"16"}}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:43:04.211Z — Explicit Resume

- WorkItem: WI-AC-014
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed pure OpenRouter 429 rate-limit exhaustion again, not a real defect. Root-caused the persistent contention: openrouter/qwen/qwen3-coder:free's 8 req/min limit is shared across the whole account and further saturated by external OpenRouter demand -- even with backoff+jitter, 4 concurrent subprojects kept exhausting it. Switched the pi adapter to NVIDIA NIM's deepseek-v4-pro (separate unshared quota pool, 40 req/min, verified reachable). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:43:05.789Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-014
- Outcome: coding agent failed three times
- Defects: Error: Model "nvidia-nim/deepseek-ai/deepseek-v4-pro" not found. Use --list-models to see available models.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T17:28:37.432Z — Explicit Resume

- WorkItem: WI-AC-014
- Outcome: user authorized a new Attempt cycle
- Guidance: This block was a real bug in my own config, not a code defect: the previous pi adapter switch referenced a made-up provider key (nvidia-nim) in models.json that pi never actually recognized -- it needed either an explicit 'api' field (unrecognized custom provider) or credentials in ~/.pi/agent/auth.json under pi's real native provider key, neither of which was done. Fixed: credentials now in auth.json under the correct native keys (nvidia, opencode-go), and the adapter points at opencode-go/deepseek-v4-flash (much higher throughput ceiling, verified working end-to-end via a direct pi invocation before this retry). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T17:33:30.000Z — AC-014 Verified

- WorkItem: WI-AC-014
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5183, zero-diff)
- Test: Black-box HTTP against running API on PORT=5183 (DynamoDB via ministack:4566, Redis:6379, SQS)
- Verdict: AC-014 passes both boundary conditions:
  1. POST valid HMAC → 202 Accepted, incident persisted (status=open, source=datadog)
  2. POST invalid HMAC → 401 Unauthorized
- Path note (doc drift, not a defect): spec AC wording says `/api/v1/webhooks/datadog`; implementation mounts webhook routes at `/v1/webhooks/:tenantId/:provider`. The `/api` prefix is absent globally (same established pattern as WI-AC-007..AC-009). Per the contradictions clause (implementation authoritative), the real boundary is `/v1/webhooks/{tenantId}/datadog`.
- Status note (doc drift, not a defect): spec says `status=received`; the codebase's IncidentStatus type is `'open' | 'triaging' | …` (no `received` literal exists). The initial creation status is `'open'` per `IngestAlertUseCase`. Functional behaviour is fully met (incident persisted with correct metadata, source provider extracted, severity mapped).
- NextAction: none
