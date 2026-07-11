# OSS dashboard: real Core incident + live SSE progress (AC-056)

## Problem

AC-056 requires creating a real incident through the OSS dashboard BFF into
Core (Postgres), then opening the detail page to a live SSE feed with
triage/investigation progress from Core — not Playwright fixture JSON.

The dashboard BFF proxied `GET /api/incidents/:id/stream` to Core
`/v1/incidents/:id/stream`, which returns 404. Core mounts the investigation
SSE at `/v1/investigation/:id/stream`.

## Solution

1. Proxy the BFF stream handler to Core `GET /v1/investigation/:id/stream`.
2. Keep the browser EventSource URL as `/api/incidents/:id/stream`.
3. Surface Core `investigation_progress` (and related) events in the detail
   UI via `data-testid="incident-sse-progress"`.
4. New-incident form requires a description (≥10 chars) and POSTs
   `/api/incidents` so the AC-022 credits ledger runs before Core create.
5. Playwright `tests/oss/ac-056-incident.spec.ts` asserts BFF create → Core
   persistence → `text/event-stream` → non-empty progress (no `page.route`
   mocks of `/api/incidents*`).

## Command

```bash
# Reuse healthy Core postgres/redis/hindsight; start api+worker+test-app
cd ../core && docker compose up -d --no-deps causeflow-test-app causeflow-api causeflow-worker

# Dashboard against host Core
CORE_API_URL=http://127.0.0.1:3099 JWT_SECRET=oss-dev-jwt-secret-change-me \
  CAUSEFLOW_RUNTIME=oss pnpm --filter dashboard exec next dev --hostname 127.0.0.1 -p 3001

PLAYWRIGHT_OSS=1 SKIP_WEB_SERVER=1 \
  pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-056-incident.spec.ts
```
