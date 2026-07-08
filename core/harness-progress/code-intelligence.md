# code-intelligence workflow journal

## 2026-07-08T15:33:00.517Z — Resumed

- WorkItem: WI-AC-028
- PreviousPhase: claimed
- Attempt: 1
- NextAction: start-orchestrator

## 2026-07-08T15:33:48.364Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-028
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests per minute. Please retry shortly.","code":429,"metadata":{"headers":{"X-RateLimit-Limit":"8","X-RateLimit-Remaining":"0","X-RateLimit-Reset":"1783524840000"},"provider_name":null}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:22:10.512Z — Explicit Resume

- WorkItem: WI-AC-028
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed via the log-detail fix: this block was pure OpenRouter 429 rate-limit exhaustion on qwen3-coder:free (8 req/min), not a real coding/QA defect -- the Work Item was never actually attempted. Also fixed the root cause (orchestrator now backs off before retrying after a 429 instead of instantly re-exhausting the same limit). Retry.
- NextAction: Coding Attempt 1
