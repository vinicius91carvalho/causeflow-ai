# Sprint 01 — Schema Remap + SystemStatus Endpoint Fix

**Batch:** 1
**Depends on:** —
**Model:** sonnet
**Estimated:** 30–45 min

## Objective

Eliminate the schema-mismatch bug that makes "Total Analyses" render wrong, and repoint `SystemStatus` from `/api/health/detailed` to `/api/health`. This is the unblock sprint: every later sprint depends on the contract being correct.

## Context (from PRD sections 4, 6.1, 8)

- Core returns `{ total, openCount, mttrMinutes, byStatus, bySeverity, totalCostUsd, avgCostUsd }` from `GET /v1/analytics/incidents`.
- Dashboard's `IncidentAnalytics` type (authoritative) is `{ totalIncidents, openIncidents, mttr, byStatus, bySeverity, totalCostUsd, avgCostUsd }`.
- The remap MUST happen inside `HttpApiClient.getIncidentAnalytics()`. Every consumer must see the dashboard shape. Introduce a private `CoreIncidentAnalyticsWire` interface at the top of `http-api-client.ts`.
- `healthDetailed()` — inspect Core's `/health/detailed` response. If its field names match `HealthDetailedStatus`, leave alone. If not, add an analogous remap.
- `system-status.tsx` currently fetches `/api/health/detailed`. Must change to `/api/health`. The state type changes from `HealthDetailedStatus` to `HealthStatus`. Remove the dependencies list UI — `/api/health` is a lightweight liveness check with only `{ status, version }`. Keep the error-state, skeleton, and status-badge logic.
- Verify `app/api/health/route.ts` exists. If it does not, create it as a thin re-export from `contexts/shared/api/health-handler`. If a `health-handler` doesn't exist either, create one that calls `apiClient.healthCheck()` via `withAuth()`.

## Tasks

1. Open `apps/dashboard/src/lib/api/http-api-client.ts`.
2. Add private `CoreIncidentAnalyticsWire` interface near the top (below imports).
3. Add private `mapIncidentAnalytics(raw)` method that returns `IncidentAnalytics` exactly per PRD §8.
4. Change `getIncidentAnalytics` to `const raw = await this.request<CoreIncidentAnalyticsWire>('/v1/analytics/incidents'); return this.mapIncidentAnalytics(raw);`.
5. Inspect `Core /health/detailed` response shape by reading `/root/projects/causeflow/core/src/modules/*/infra/health.routes.ts` or equivalent. If the shape matches `HealthDetailedStatus`, add a code comment `// verified matches HealthDetailedStatus`. Otherwise add a parallel `mapHealthDetailed` remap.
6. Open `apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx`. Change the fetch URL to `/api/health`. Change the state type from `HealthDetailedStatus` to `HealthStatus`. Remove the dependencies list JSX and the `Clock`/`latency` imports if now unused. Keep the status badge, version line, error state, and skeleton.
7. Verify `apps/dashboard/src/app/api/health/route.ts` exists. If missing, create it as: `export { GET } from '@/contexts/shared/api/health-handler';`. If `health-handler.ts` does not exist, create it with `withAuth()` calling `apiClient.healthCheck()`.
8. Write Vitest unit test `http-api-client.test.ts` covering: (a) wire→domain remap with all fields populated, (b) `mttrMinutes: null` → `mttr: 0`, (c) round-trip integrity of `byStatus`/`bySeverity`/`totalCostUsd`/`avgCostUsd`.
9. Write/update `system-status.test.tsx` to assert the component fetches `/api/health` (mock `fetch`, assert URL arg).

## Acceptance Criteria

- [x] `HttpApiClient.getIncidentAnalytics()` returns dashboard-shape `IncidentAnalytics` regardless of Core's wire shape. (mapIncidentAnalytics private method in http-api-client.ts, CoreIncidentAnalyticsWire is private to that file; 4 vitest cases verify all fields, mttrMinutes→0 fallback, and field isolation)
- [x] `SystemStatus` component fetches `/api/health` exclusively. No reference to the detailed variant remains in that file. (system-status.tsx refactored: HealthStatus state type, dependency-list UI removed, version-only card; 4 vitest cases verify)
- [x] `apps/dashboard/src/app/api/health/route.ts` exists and returns 200 when called. (already existed before sprint; thin re-export from contexts/shared/api/health-handler.ts which returns `{status:'ok', version, timestamp}` with 200)
- [x] All new Vitest tests pass. (15/15 new tests across 3 files; full dashboard suite 505/505)
- [x] Biome clean on modified files (0 errors; pre-existing `noExplicitAny` warnings are out of scope).
- [ ] `pnpm turbo check-types` green — BLOCKED by 2 pre-existing errors on main unrelated to Sprint 1: (1) `intelligence-page.tsx` imports missing `react-markdown`, (2) `services.test.ts` uses `'free'` which is no longer in `TenantPlan`. Logged as out-of-scope discoveries.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/lib/api/http-api-client.test.ts          # if not present; otherwise modify
  - apps/dashboard/src/app/api/health/route.ts                  # only if missing
  - apps/dashboard/src/contexts/shared/api/health-handler.ts    # only if missing

files_to_modify:
  - apps/dashboard/src/lib/api/http-api-client.ts
  - apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx
  - apps/dashboard/src/contexts/shared/presentation/components/system-status.test.tsx

files_read_only:
  - apps/dashboard/src/lib/api/core-api-types.ts
  - /root/projects/causeflow/core/src/modules/ingestion/application/get-incident-analytics.usecase.ts
  - /root/projects/causeflow/core/src/modules/ingestion/infra/analytics.routes.ts
  - apps/dashboard/src/lib/api/with-auth.ts

shared_contracts:
  - IncidentAnalytics (core-api-types.ts)
  - HealthStatus (core-api-types.ts)
```

## Verification Steps

1. `pnpm --filter dashboard test -- http-api-client system-status`
2. `pnpm turbo check-types --filter=dashboard`
3. Visual: start dev server, open `/dashboard`, open devtools network, verify `GET /api/health` 200 and `GET /api/metrics` (downstream of `getIncidentAnalytics`) returns the remapped shape.
