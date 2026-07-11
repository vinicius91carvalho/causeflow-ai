# OSS dashboard: investigation LLM connector selection (AC-059)

## Problem

AC-059 requires the OSS dashboard (or a settings surface it proxies) to select
Core's investigation LLM connector. Default is Ornith 9B on `:8081`. When
Ornith's ~32k context is insufficient (`LLM_CONTEXT_TOO_LARGE` from Core), the
operator switches to DeepSeek V4 Flash via OpenCode Go or NVIDIA NIM using
runtime host credentials — never committed to the repo.

## Solution

1. BFF `GET/PUT /api/settings/llm-connector` proxies Core
   `GET/PUT /v1/oss/llm-connector` with the `__session` Bearer (same pattern as
   fire-test-errors).
2. Settings page renders `LlmConnectorCard` when `isOssRuntime()` — shows active
   connector, overflow code, and Ornith / deepseek-opencode / deepseek-nim options.
3. Playwright `tests/oss/ac-059-llm-connector.spec.ts` asserts BFF default =
   Ornith, PUT switches to `deepseek-opencode`, Core connector + UI reflect
   DeepSeek, then restores Ornith for sibling specs.

## Command

```bash
# Prerequisites: Core api+worker healthy on :3099, Ornith on :8081,
# Core OPENCODE_API_KEY set from operator host (~/.pi/agent/auth.json).

CORE_API_URL=http://127.0.0.1:3099 JWT_SECRET=oss-dev-jwt-secret-change-me \
  CAUSEFLOW_RUNTIME=oss pnpm --filter dashboard exec next dev --hostname 127.0.0.1 -p 3001

PLAYWRIGHT_OSS=1 SKIP_WEB_SERVER=1 OSS_DASHBOARD_URL=http://127.0.0.1:3001 \
  pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-059-llm-connector.spec.ts
```
