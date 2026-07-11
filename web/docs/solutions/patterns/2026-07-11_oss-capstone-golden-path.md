# OSS capstone Playwright suite: full golden path delivery gate (AC-061)

## Problem

Goal Review / `run_completed` on web must prove the full open-source delivery path,
not partial AC-055/057 smoke. Operators and harness QA need one Playwright scenario
that chains AC-054..AC-060 against compose Core and exits 0 only when every stage
passes.

## Solution

1. Capstone spec `tests/oss/ac-061-capstone.spec.ts` under project `dashboard-oss-e2e`.
2. Stages asserted in one serial test:
   - AC-054 local auth (`__session` from Core register/login setup)
   - AC-058 connect Test Application + enable Datadog stub
   - AC-059 Ornith default → DeepSeek switch → restore Ornith
   - AC-056/AC-060 create incident → analyses → SSE triage → root cause →
     remediation → model-backed chat
3. Pass path is compose Core + test app + Ornith (DeepSeek credentials for the
   configure stage only). Not a pass path: Clerk, `.env.staging`, `page.route`
   BFF mocks, DeterministicLLMClient.

## Command (Goal Review evidence)

```bash
# Shared infra (postgres/redis) already healthy — reuse Core api/worker/test-app.
# Ornith on :8081. Host dashboard against Core :3099:
CORE_API_URL=http://127.0.0.1:3099 JWT_SECRET=oss-dev-jwt-secret-change-me \
  CAUSEFLOW_RUNTIME=oss pnpm --filter dashboard exec next dev --hostname 127.0.0.1 -p 5170

PLAYWRIGHT_OSS=1 SKIP_WEB_SERVER=1 OSS_DASHBOARD_URL=http://127.0.0.1:5170 \
  pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-061-capstone.spec.ts
```

The project-wide command `pnpm exec playwright test --project=dashboard-oss-e2e`
also includes this capstone (plus the focused AC-055..AC-060 specs). For Goal
Review, prefer the capstone file above so AC-057's Ornith stop probe does not
interfere with the delivery gate.
