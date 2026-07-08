# observability-and-ops workflow journal

## 2026-07-08T15:55:46.849Z — Resumed

- WorkItem: WI-AC-036
- PreviousPhase: claimed
- Attempt: 1
- NextAction: start-orchestrator

## 2026-07-08T15:56:37.412Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-036
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests per minute. Please retry shortly.","code":429,"metadata":{"headers":{"X-RateLimit-Limit":"8","X-RateLimit-Remaining":"0","X-RateLimit-Reset":"1783526220000"},"provider_name":null}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:43:26.606Z — Explicit Resume

- WorkItem: WI-AC-036
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed pure OpenRouter 429 rate-limit exhaustion again, not a real defect. Root-caused the persistent contention: openrouter/qwen/qwen3-coder:free's 8 req/min limit is shared across the whole account and further saturated by external OpenRouter demand -- even with backoff+jitter, 4 concurrent subprojects kept exhausting it. Switched the pi adapter to NVIDIA NIM's deepseek-v4-pro (separate unshared quota pool, 40 req/min, verified reachable). Retry.
- NextAction: Coding Attempt 1
