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
