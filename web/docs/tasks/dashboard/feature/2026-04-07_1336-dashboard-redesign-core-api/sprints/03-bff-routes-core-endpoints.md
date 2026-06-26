# Sprint 03 — BFF Routes for Previously-Unused Core Endpoints

**Batch:** 2
**Depends on:** 01
**Model:** sonnet
**Estimated:** 60–75 min
**Runs in parallel with:** Sprint 02

## Objective

Expose the Core endpoints the new dashboard needs via thin BFF route handlers, each wrapped in `withAuth()` and each proxying to a `HttpApiClient` method. No business logic. No caching.

## Context

Each route below follows the existing pattern (see `contexts/shared/api/notifications-handler.ts` and `contexts/shared/api/pattern-analytics-handler.ts`): a handler file in the relevant context's `api/` directory + a thin re-export at `app/api/.../route.ts`.

Routes to add/verify:

| BFF Route | Core Method | Owning Context | Handler File |
|---|---|---|---|
| `GET /api/approvals/pending` | `listPendingApprovals()` | approvals | `contexts/approvals/api/approvals-pending-handler.ts` |
| `GET /api/relay/status` | `getRelayStatus()` | integrations | `contexts/integrations/api/relay-status-handler.ts` |
| `GET /api/memory/insights` | `getMemoryInsights()` | shared | `contexts/shared/api/memory-insights-handler.ts` |
| `GET /api/billing/usage` | `getUsageHistory()` | billing | `contexts/billing/api/usage-handler.ts` |
| `GET /api/topology/health` | `getSystemHealth()` | shared | `contexts/shared/api/topology-health-handler.ts` |
| `GET /api/incidents?status=active` | `listIncidents({ status: 'active' })` | investigation | verify existing `analyses-handler` OR add a dedicated `incidents-list-handler.ts` |
| `GET /api/notifications` | `listNotifications()` | shared | **already exists** — verify behavior |

Note that `/api/notifications` already exists per CLAUDE.md; just confirm it works for this use case. `/api/incidents` likely exists in some form; verify and, if it does not support a status filter, add a passthrough that forwards `status` and `limit` query params.

## Tasks

1. [x] For each row above (except notifications which exists), create the handler file following the `notifications-handler` pattern: import `withAuth`, import `apiClient`, define `GET = withAuth(async ({ apiClient }) => NextResponse.json(await apiClient.<method>()))`.
2. [x] For each handler, create the `app/api/.../route.ts` thin re-export.
3. [x] For each handler, write a Vitest integration test that mocks `apiClient` and asserts: (a) 200 status, (b) body is the Core method's return value, (c) 401 when unauthenticated.
4. [x] Verify `/api/incidents` supports `?status=active`. If not, add a thin passthrough handler that forwards the query param to `listIncidents({ status })`.
5. [x] Verify `/api/notifications` returns data usable for a "recent notifications" list (limit 5). If it forces defaults that produce too-large responses, add `?limit=5` support.
6. [x] Update `apps/dashboard/CLAUDE.md` API table to add the new routes under the correct groupings.

## Acceptance Criteria

- [x] All six (or more) new BFF routes exist and return 200 under authenticated test stubs.
- [x] All handlers use `withAuth()`. No direct `Core` calls from routes.
- [x] Vitest integration tests pass for each new handler.
- [x] `/api/incidents?status=active` returns filtered results.
- [x] `apps/dashboard/CLAUDE.md` API section updated.
- [x] `pnpm turbo check-types` green.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/approvals/api/approvals-pending-handler.ts
  - apps/dashboard/src/app/api/approvals/pending/route.ts
  - apps/dashboard/src/contexts/integrations/api/relay-status-handler.ts
  - apps/dashboard/src/app/api/relay/status/route.ts
  - apps/dashboard/src/contexts/shared/api/memory-insights-handler.ts
  - apps/dashboard/src/app/api/memory/insights/route.ts
  - apps/dashboard/src/contexts/billing/api/usage-handler.ts
  - apps/dashboard/src/app/api/billing/usage/route.ts
  - apps/dashboard/src/contexts/shared/api/topology-health-handler.ts
  - apps/dashboard/src/app/api/topology/health/route.ts
  # Test files colocated with each handler

files_to_modify:
  - apps/dashboard/CLAUDE.md
  # Possibly: apps/dashboard/src/contexts/investigation/api/analyses-handler.ts (add status filter)

files_read_only:
  - apps/dashboard/src/contexts/shared/api/notifications-handler.ts
  - apps/dashboard/src/contexts/shared/api/pattern-analytics-handler.ts
  - apps/dashboard/src/lib/api/with-auth.ts
  - apps/dashboard/src/lib/api/http-api-client.ts

shared_contracts:
  - withAuth HOC signature
  - ICoreApiClient interface
```

## Verification Steps

1. `pnpm --filter dashboard test -- approvals-pending relay-status memory-insights usage-handler topology-health`
2. `pnpm turbo check-types --filter=dashboard`
3. Start dev server and `curl -H 'Cookie: <session>' http://localhost:3001/api/approvals/pending` → 200.

## Agent Notes

### Decisions

1. **relay-status and memory-insights handlers already existed** in `contexts/shared/api/` (not `contexts/integrations/api/` as the spec table suggested). The route files at `app/api/relay/status/route.ts` and `app/api/memory/insights/route.ts` already re-exported from `shared/api/`. Decision: kept existing locations, added tests only. 🟢 HIGH confidence — files existed and routes worked.

2. **`/api/incidents` needed a new route** — no top-level `GET /api/incidents` existed (only `analyses-handler.ts` at `/api/analyses`). Created `incidents-list-handler.ts` in `contexts/investigation/api/` as a clean separation. Forwarded `?status`, `?limit`, and `?cursor` query params. 🟢

3. **`/api/notifications` already supports `?limit`** — `notifications-handler.ts` reads `url.searchParams.get('limit')` with default 10, max 100. No changes needed. 🟢

4. **Biome hook non-blocking** — The PostToolUse Biome hook reports "No files were processed" for worktree paths. This is because Biome's `biome.json` is scoped to the main repo root, not worktree paths. Non-blocking; actual lint will run at merge time against the main repo path.

5. **3 pre-existing test failures** — `choose-plan-page.test.tsx` times out (15s) in proot environment. Pre-existing on main, unrelated to Sprint 3 changes. 518/521 tests pass in full suite.

### Files created (not in spec boundaries)
- `apps/dashboard/src/contexts/investigation/api/incidents-list-handler.ts` — added because `/api/incidents` route was missing entirely (spec said "verify existing OR add")
- `apps/dashboard/src/contexts/investigation/api/incidents-list-handler.test.ts` — test for above
- `apps/dashboard/src/app/api/incidents/route.ts` and `.test.ts` — route re-export for above
- `apps/dashboard/src/contexts/shared/api/relay-status-handler.test.ts` — test for existing handler
- `apps/dashboard/src/contexts/shared/api/memory-insights-handler.test.ts` — test for existing handler

### Notifications limit status
`/api/notifications` already supports `?limit=N` (reads searchParams, defaults to 10, caps at 100). The `?limit=5` use case works without any code change.
