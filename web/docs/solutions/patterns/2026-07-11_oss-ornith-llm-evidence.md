# OSS dashboard: Ornith 9B LLM evidence for investigation (AC-057)

## Problem

AC-057 requires the AC-056 incident happy path to use Core's default
OpenAI-compatible LLM connector pointed at local Ornith 9B
(`http://127.0.0.1:8081/v1`, model `Ornith-1.0-9B-code`), with evidence of
≥1 successful local completion. Anthropic must not be required, and a silent
`DeterministicLLMClient` stub must not be the pass path. When Ornith is down,
the check fails closed with a clear Core `llm` health error.

## Solution

1. Wire `LLM_CONNECTOR` / `LLM_BASE_URL` / `LLM_MODEL` (plus `extra_hosts` for
   `host.docker.internal`) on web `docker-compose.yml` api + worker so the
   bundled OSS stack reaches host Ornith the same way Core's compose does.
2. Playwright `tests/oss/ac-057-ornith-llm.spec.ts`:
   - Asserts Ornith `/v1/models`, Core `/health` `llm=ok`, and
     `GET /v1/oss/llm-connector` active=`ornith` / model=`Ornith-1.0-9B-code`.
   - Creates an incident via dashboard BFF (AC-056 path), opens detail SSE,
     polls `GET /api/investigation/:id/detail` until evidence metadata shows
     `source=llm_completion` / `llmModel=Ornith-1.0-9B-code`.
   - Briefly `SIGSTOP`s host `llama-server`, asserts Core `/health` `llm` is
     not `ok`, then `SIGCONT`s and waits for recovery (no compose teardown).

## Command

```bash
# Prerequisites: Core api+worker healthy on :3099, Ornith on :8081
# (~/tools/llama-session.sh), postgres/redis/hindsight reused.

CORE_API_URL=http://127.0.0.1:3099 JWT_SECRET=oss-dev-jwt-secret-change-me \
  CAUSEFLOW_RUNTIME=oss pnpm --filter dashboard exec next dev --hostname 127.0.0.1 -p 3001

PLAYWRIGHT_OSS=1 SKIP_WEB_SERVER=1 OSS_DASHBOARD_URL=http://127.0.0.1:3001 \
  pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-057-ornith-llm.spec.ts
```
