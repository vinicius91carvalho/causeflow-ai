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

## 2026-07-08T16:43:28.158Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-036
- Outcome: coding agent failed three times
- Defects: Error: Model "nvidia-nim/deepseek-ai/deepseek-v4-pro" not found. Use --list-models to see available models.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T21:03:32.451Z — Explicit Resume

- WorkItem: WI-AC-036
- Outcome: user authorized a new Attempt cycle
- Guidance: This block was a real bug in my own config, not a code defect: the previous pi adapter switch referenced a made-up provider key (nvidia-nim) in models.json that pi never actually recognized -- it needed either an explicit 'api' field (unrecognized custom provider) or credentials in ~/.pi/agent/auth.json under pi's real native provider key, neither of which was done. Fixed: credentials now in auth.json under the correct native keys (nvidia, opencode-go), and the adapter points at opencode-go/deepseek-v4-flash (much higher throughput ceiling, verified working end-to-end via a direct pi invocation before this retry). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T21:12:00.000Z — QA Verified (WI-AC-036)

- WorkItem: WI-AC-036
- Phase: qa
- Outcome: implementation=true qa=true
- Verification:
  - API booted on PORT=5187, health endpoint returns 200
  - 386/386 unit tests pass including all observability tests (otel, sentry, outbound, propagation, worker-runner, noop-tracer, observability-factory)
  - x-request-id header verified on every API response (unique UUID per request)
  - POST /v1/admin/fire-test-errors returns 500 with `{"error":"TestErrorFired","traceId":"<uuid>"}` — traceId matches x-request-id header, confirming correlation id flow works end-to-end
  - Auth middleware properly rejects unauthenticated requests (401)
  - CORS exposes X-Request-Id header for Langfuse searchability
  - OTel infrastructure: HTTP auto-instrumentation via NodeSDK (guarded in OSS runtime), `instrumentedCall` spans at 6+ integration points (clerk, composio, anthropic, db, sqs, redis), trace context propagated via SQS MessageAttributes
  - Sentry infrastructure: `initSentry()` in main.ts, `captureException()` with scope tags (requestId, tenantId, userId, method, path) and PII scrubbing in error-handler.ts; no-op when SENTRY_DSN unset
  - Langfuse bridge: LangfuseTracer creates traces/observations when configured; OTLP export path exists for OTel-to-Langfuse
  - No defects found — code correctly implements OTEL span generation with correlation ID and Sentry error capture

## 2026-07-08T21:14:03.649Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-036
- DefectReport: ## QA Summary

**WI-AC-036: Observability and Ops** — **PASS**

### What was tested

1. **Real HTTP API behavior**: Verified the running API (PORT=5187) returns `x-request-id` on every response — each request gets a unique UUID correlation ID.

2. **End-to-end error correlation**: Called `POST /v1/admin/fire-test-errors` (designed for Sentry/OTel testing). The response confirmed the `traceId` field exactly matches the `x-request-id` header — proving the correlation ID flows correctly through the middleware stack.

3. **Unit tests**: Ran 386 tests across all observability-related modules — all pass (otel, sentry, outbound, propagation, worker-runner, error-handler, remediation routes, etc.).

4. **Code verification**:
   - **OTel**: `otel.ts` initializes NodeSDK with HTTP auto-instrumentation, AWS X-Ray ID generator, X-Ray propagator. `instrumentedCall()` wraps 6+ integration points (clerk, composio, anthropic, db, sqs, redis) with OTel spans. Trace context propagates via SQS `MessageAttributes`.
   - **Sentry**: `initSentry()` in `main.ts` with PII scrubbing. `captureException()` with scope tags (requestId, tenantId, userId, method, path). Error handler calls it for 5xx and unhandled errors.
   - **Langfuse**: `LangfuseTracer` creates traces/observations when `LANGFUSE_PUBLIC_KEY`/`SECRET_KEY` are configured. OTLP export path bridges OTel spans to Langfuse.

### Defects

None. Both parts of AC-036 are correctly implemented. Langfuse and Sentry end-to-end verification require runtime configuration (keys + services) which is inactive by design in the OSS build.
- RepairPlan: WI-AC-036 (observability-and-ops) PASS — QA found zero defects. The repository contains every structure required by the project specs: OTel NodeSDK with AWS X-Ray ID generator/propagator (`otel.ts`), Sentry init with PII scrubbing (`sentry.ts`), Langfuse tracer + metric recorder with noop fallbacks, `instrumentedCall` wrapping 7 integration points, SQS trace propagation, `POST /v1/admin/fire-test-errors` endpoint returning `traceId` matching `x-request-id`, `TestErrorFiredError` extending `AppError` with status 500, and 386 passing unit tests covering all observability modules. Langfuse/Sentry end-to-end require runtime keys (inactive by design in OSS build), documented as expected. Verified 10 source files + 4 test files — all present and correctly wired.; None required — acceptance check PASS verified against both the QA evidence and repository audit.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/observability-and-ops/WI-AC-036-1-qa.log
- NextAction: Coding Attempt 2
