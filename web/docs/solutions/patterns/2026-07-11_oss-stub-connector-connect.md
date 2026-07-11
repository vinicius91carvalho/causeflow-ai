# OSS dashboard stub connector connect (AC-055)

## Problem

Open-source E2E must connect an integration through Core's stub upstream
(`/v1/integrations/stub/connect` → causeflow-test-app on `:5190`), not Composio
and not Playwright `page.route` fakes of the dashboard BFF.

## Solution

1. Dashboard BFF `POST /api/integrations/stub/connect` proxies to Core stub connect.
2. OSS catalog injects a `stub-upstream` card; Connect one-clicks the stub path.
3. Integrations list normalizes Core `displayName`/`provider` so Connected state renders.
4. Playwright `dashboard-oss-e2e` dismisses the welcome modal, clicks Connect, asserts
   UI Connected + stub `/v1/state` growth + `GET /api/integrations` record.

## Locale rewrite note

Middleware `NextResponse.rewrite()` to absolute `/en/...` URLs can be treated as
external proxies when Host/bind disagree (`localhost` vs `127.0.0.1`). Prefer
`next.config.mjs` `rewrites()` for default-locale prefixing; middleware only
auths and returns `NextResponse.next()`.

## Command

```bash
# Core compose: postgres/redis/hindsight (reuse) + api + test-app
# Dashboard: CORE_API_URL=http://127.0.0.1:3099 CAUSEFLOW_RUNTIME=oss on :3001
pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-055-integrations.spec.ts
```
