# OSS dashboard: connect test application + enable additional connector (AC-058)

## Problem

Open-source golden path needs the dashboard user to connect a Core-owned
**runnable test application** and enable at least one additional connector
against it. AC-055 only covered a single stub-upstream connect.
Composio and Playwright `page.route` BFF mocks are not the pass path.

## Solution

1. Catalog injects **Test Application (OSS)** (`stub-upstream`) and overrides
   Datadog to an OSS credential card that enables via Core stub.
2. BFF `POST /api/integrations/stub/connect` → Core stub connect (test app).
3. BFF `POST /api/integrations/stub/enable` → Core
   `POST /v1/integrations/stub/enable` persists a second IntegrationRecord
   (e.g. `datadog`) linked to the connected test app — no KMS/Composio.
4. Playwright `tests/oss/ac-058-test-app-integrations.spec.ts` asserts both
   cards show Connected after reload and `GET /api/integrations` lists both.

## Command

```bash
# Reuse healthy Core postgres/redis/hindsight; ensure api + test-app
cd ../core && docker compose up -d --no-deps causeflow-api causeflow-test-app
# Dashboard with CORE_API_URL=http://127.0.0.1:3099 CAUSEFLOW_RUNTIME=oss
pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-058-test-app-integrations.spec.ts
```
