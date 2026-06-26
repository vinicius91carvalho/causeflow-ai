# PRD: Dashboard Redesign with Core API Integration

**Status:** Build Candidate
**Mode:** PRD + Sprint
**Created:** 2026-04-07 13:36
**Owner:** Dashboard team
**Estimated effort:** 4–6 hours (5 sprints)

---

## 1. Problem Statement

The current `/dashboard` overview page has three concrete defects and a strategic gap:

1. **Schema mismatch (data is wrong on screen).** `HttpApiClient.getIncidentAnalytics()` calls Core's `/v1/analytics/incidents`, which returns `{ total, openCount, mttrMinutes, byStatus, bySeverity, totalCostUsd, avgCostUsd }`. The dashboard's TypeScript type `IncidentAnalytics` expects `{ totalIncidents, openIncidents, mttr, ... }`. As a result, the "Total Analyses" metric card always reads `undefined` (rendered as 0 or NaN) even when incidents exist. Same risk for `healthDetailed()` if its consumer's expected fields drift from Core.
2. **Wrong endpoint for the SystemStatus card.** `system-status.tsx` calls `/api/health/detailed` even though product intent is "show liveness", not full dependency tree. We want it to call `/api/health` (the lightweight liveness endpoint).
3. **Stale metric.** The "Analyses this month" card is duplicative with "Total Analyses" and is being removed.
4. **Strategic gap: unused Core capability.** Core exposes `listPendingApprovals`, `listNotifications`, `getSystemHealth` (graph health), `getRelayStatus`, `getMemoryInsights`, `getUsageHistory`, and `listIncidents` filtered by active status. The dashboard shows none of these, leaving the overview thin and ignoring the product's differentiating signals (approvals queue, relay status, memory insights, system health summary).

The empty state also has a single branch ("no analyses → show welcome"), but a user with **no integrations** cannot meaningfully create an analysis. The empty state must branch on integrations as well.

---

## 2. Goals

1. Total Analyses card displays the correct integer from Core (no schema drift).
2. SystemStatus card calls `/api/health` and renders successfully.
3. "Analyses this month" card is removed.
4. The `/dashboard` overview page has three distinct, deterministic empty-state branches based on `(hasAnalyses, hasIntegrations)`:
   - **Branch A** — no analyses + no integrations → Welcome panel with two CTAs: "Connect Integration" → `/dashboard/integrations`, "Set up Relay" → `/dashboard/relay`.
   - **Branch B** — no analyses + has integrations → Welcome panel with single CTA: "Create Your First Analysis" → `/dashboard/analyses/new`.
   - **Branch C** — has analyses + has integrations → "System operational" status card + the full new dashboard layout populated by Core APIs.
5. The full dashboard (Branch C) integrates the previously unused Core endpoints into named sections: Active Incidents, Pending Approvals, Recent Notifications, System Health (graph), Relay Status, Memory Insights, Usage History.
6. Every section consumes data from a real BFF route (`/api/...`) which proxies to Core via `HttpApiClient`. No mock data, no client-side fabrication.
7. Playwright E2E coverage for all 3 empty-state branches and the full dashboard, asserting both rendered text and that the underlying network requests returned 200.
8. Dev server must start cleanly with zero runtime errors and zero unhandled rejections during the E2E run.

## 3. Non-Goals

- Redesigning any route other than `/dashboard` (the overview page).
- Creating new Core endpoints. We only consume what already exists in `/root/projects/causeflow/core`.
- Refactoring `HttpApiClient` beyond fixing the `getIncidentAnalytics` and `healthDetailed` schema gaps.
- Building real-time / websocket updates. Polling or per-navigation fetch is acceptable.
- Changing RBAC or authentication.
- Mobile-only redesign work outside the standard Tailwind responsive grid.

---

## 4. Context Loaded

| Source | What we learned |
|---|---|
| `apps/dashboard/src/lib/api/http-api-client.ts` | `getIncidentAnalytics()` returns the raw Core JSON via `request<IncidentAnalytics>('/v1/analytics/incidents')` with no remapping. `healthCheck()` calls `/health`; `healthDetailed()` calls `/health/detailed`. The client also already implements `listPendingApprovals`, `listNotifications`, `getSystemHealth`, `getRelayStatus`, `getMemoryInsights`, `getUsageHistory`, and `listIncidents` — they are wired but unused on the overview page. |
| `apps/dashboard/src/lib/api/core-api-types.ts` (line 73) | `IncidentAnalytics` is declared as `{ totalIncidents, openIncidents, mttr, ... }`. This is the dashboard's contract. |
| `core/src/modules/ingestion/application/get-incident-analytics.usecase.ts` | Core's actual return is `{ total, byStatus, bySeverity, mttrMinutes, openCount, totalCostUsd, avgCostUsd }`. **This is the schema mismatch.** |
| `apps/dashboard/src/contexts/shared/presentation/components/system-status.tsx` (line 78) | Currently calls `fetch('/api/health/detailed')`. Must be changed to `/api/health`. The existing `HealthStatus` type from `core-api-types` is the lightweight shape. |
| `apps/dashboard/src/contexts/shared/presentation/components/dashboard-overview.tsx` | Has `hasAnalyses` boolean only. Empty-state currently single-branch: `!hasAnalyses → DashboardEmptyState`. No integrations check. |
| `apps/dashboard/src/contexts/shared/presentation/pages/dashboard-page.tsx` | Server component. Reads i18n, hands a `messages` prop into `<DashboardOverview>`. Currently passes only `metrics`, `credits`, `savingHours`, `recentAnalyses`, `quickActions`, `emptyState` namespaces — needs extension for new sections and the new branch-A copy. |
| `apps/dashboard/CLAUDE.md` | Routes already exist: `/dashboard/integrations`, `/dashboard/analyses/new`. **`/dashboard/relay` is NOT in the route table** — must be verified during sprint 4 and either created or the CTA must be downgraded. |
| `core/src/modules/ingestion/infra/analytics.routes.ts`, `notification`, `integration/relay.routes.ts`, `memory`, `billing` | All endpoints required by the new dashboard already exist in Core. |
| `apps/dashboard/CLAUDE.md` (Health API row) | Lists only `GET /api/health/detailed` — there is no BFF row for `/api/health`. We must verify whether `/api/health` exists; if not, sprint 1 must add it (thin re-export of `health-handler` already in `contexts/shared/api/`). |

**Open assumption (MEDIUM confidence):** the BFF route `/api/health` already exists because `contexts/shared/api/health-handler.ts` is listed in CLAUDE.md, but the route file under `app/api/health/route.ts` is not confirmed. Sprint 1 must verify and create the route file if missing. If creation is needed, the file boundary is recorded in sprint 1.

**Open assumption (MEDIUM confidence):** `/dashboard/relay` route. CLAUDE.md does not list it. Sprint 4 must verify; if missing, the "Set up Relay" CTA in Branch A points to `/dashboard/integrations?type=relay` instead, and this is reflected in INVARIANTS.md.

---

## 5. Correctness Discovery (full PRD+Sprint — 6 questions)

1. **Audience.** Logged-in product users (admin and member roles) landing on `/dashboard` immediately after sign-in. Decision: do they have a system that's already producing value (Branch C) or do they still need to wire something up (A/B)?
2. **Failure Definition.** The output is useless if the metric numbers are wrong, if any section shows "0" silently when the data is actually present, if the empty-state branch is wrong for the user's true integration/analysis state, or if any panel renders an error message.
3. **Danger Definition.** Actively harmful if (a) the page silently misreports incident counts (e.g., shows 0 incidents while production has unresolved incidents); (b) the SystemStatus card shows "operational" while Core is actually down; (c) user sees Branch C but no real data, eroding trust in the product.
4. **Uncertainty Policy.** Each section must **stop** on its own uncertainty: a fetch failure for one section renders an error chip in that section only, never a fabricated value, and never blocks the rest of the dashboard. The page header always renders.
5. **Risk Tolerance.** A clearly-labeled refusal ("couldn't load Pending Approvals") is strictly preferred over a confidently-wrong number. This applies per-section.
6. **Verification.** Three layers: (1) Vitest unit tests on the schema-remap logic in `getIncidentAnalytics` and on the empty-state branch selection. (2) Vitest component tests rendering each branch. (3) Playwright E2E that exercises all three branches by stubbing the BFF responses and asserts both DOM content and network 200s, plus a console-error assertion to enforce the "no errors from Next.js" rule.

---

## 6. Architecture Decisions

### 6.1 Schema remap belongs in the API client, not the consumer

`HttpApiClient.getIncidentAnalytics()` is the **single point of translation** between Core's wire format and the dashboard's domain shape. We remap **inside** this method so every consumer (current and future) sees the dashboard contract. The dashboard's `IncidentAnalytics` type is the authoritative shape; Core's wire shape is private to `http-api-client.ts`.

**Rejected alternative:** map at the React component layer. Rejected because it scatters the contract and would require every new consumer to re-derive the mapping. Future consumers would silently regress.

**Rejected alternative:** change Core to match dashboard. Rejected because Core is a separate service consumed by other clients; Web cannot make breaking changes there in this PRD.

The same pattern applies to `healthDetailed()` if we discover its expected dependencies field name diverges.

### 6.2 Per-section data fetching with Suspense-style loading and error fences

Each new section (Active Incidents, Pending Approvals, Recent Notifications, System Health, Relay Status, Memory Insights, Usage History) is a self-contained client component that:

- owns its loading skeleton, error chip, and fetch lifecycle;
- is wrapped in a try/catch boundary that maps any thrown error to a local "couldn't load" state;
- never escalates its failure to the page level.

This satisfies Goal 8 (no errors from the dashboard server) because section errors are caught client-side and never propagate to React's error boundary at the page root.

**Rejected alternative:** server-side parallel fetch in `dashboard-page.tsx`. Rejected because a single failing Core endpoint would break SSR for the whole route, violating the per-section error fence requirement.

### 6.3 Empty-state branching is a single pure function

Branch selection is computed in one place: `selectEmptyStateBranch({ hasAnalyses, hasIntegrations }) → 'A' | 'B' | 'C'`. This function lives in `contexts/shared/presentation/lib/empty-state-branch.ts` and is unit-tested exhaustively (4 input combinations). Components ask the function; they do not re-implement the logic.

### 6.4 BFF passthrough, not new business logic

For each Core endpoint we surface, the dashboard exposes a thin BFF route under `/api/...` that calls the corresponding `HttpApiClient` method via `withAuth()`. No transformation, no caching, no business rules. This matches the existing BFF style (notifications, pattern-analytics, topology) and makes the new endpoints testable in isolation.

---

## 7. Data Flow

```
Browser
  └─ /dashboard (server component, SSR)
       ├─ DashboardOverview (client)
       │    ├─ fetch /api/metrics             ──► HttpApiClient.getIncidentAnalytics ──► Core /v1/analytics/incidents
       │    │    └─ remap inside HttpApiClient
       │    ├─ fetch /api/integrations        ──► HttpApiClient.listIntegrations
       │    └─ selectEmptyStateBranch(hasAnalyses, hasIntegrations) ──► A | B | C
       │
       ├─ Branch A → <BranchAEmptyState>      (Connect Integration / Set up Relay)
       ├─ Branch B → <BranchBEmptyState>      (Create Your First Analysis)
       └─ Branch C
            ├─ <SystemStatus>                 fetch /api/health
            ├─ <ActiveIncidentsSection>        fetch /api/incidents?status=open
            ├─ <PendingApprovalsSection>       fetch /api/approvals/pending
            ├─ <RecentNotificationsSection>    fetch /api/notifications
            ├─ <SystemHealthSection>           fetch /api/topology/health
            ├─ <RelayStatusSection>            fetch /api/relay/status
            ├─ <MemoryInsightsSection>         fetch /api/memory/insights
            └─ <UsageHistorySection>           fetch /api/billing/usage
```

Every fetch above must return 200 in the happy-path E2E. Each route returns the dashboard's domain shape (after `HttpApiClient` remap where applicable).

---

## 8. Shared Contracts

These types are the contract between sprints. Sprint authors must not invent alternative names.

```ts
// contexts/shared/presentation/lib/empty-state-branch.ts
export type EmptyStateBranch = 'A' | 'B' | 'C';
export function selectEmptyStateBranch(input: {
  hasAnalyses: boolean;
  hasIntegrations: boolean;
}): EmptyStateBranch;
```

```ts
// lib/api/core-api-types.ts (existing — confirmed canonical)
export interface IncidentAnalytics {
  totalIncidents: number;   // remapped from Core's `total`
  openIncidents: number;    // remapped from Core's `openCount`
  mttr: number;             // remapped from Core's `mttrMinutes` (0 when null)
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  totalCostUsd: number;
  avgCostUsd: number | null;
}
```

```ts
// HttpApiClient remap (sprint 1)
private mapIncidentAnalytics(raw: CoreIncidentAnalyticsWire): IncidentAnalytics {
  return {
    totalIncidents: raw.total,
    openIncidents: raw.openCount,
    mttr: raw.mttrMinutes ?? 0,
    byStatus: raw.byStatus,
    bySeverity: raw.bySeverity,
    totalCostUsd: raw.totalCostUsd,
    avgCostUsd: raw.avgCostUsd,
  };
}
```

```ts
// CoreIncidentAnalyticsWire — private to http-api-client.ts
interface CoreIncidentAnalyticsWire {
  total: number;
  openCount: number;
  mttrMinutes: number | null;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  totalCostUsd: number;
  avgCostUsd: number | null;
}
```

---

## 9. Security Boundaries

- All new BFF routes use `withAuth()` (session + RBAC + per-user rate limit). No exceptions.
- No Core API responses are cached client-side beyond the lifetime of a page navigation.
- No PII or token material is logged in section error chips. Errors render a generic "Couldn't load <section>" message; raw error text is logged to console only in dev.
- The "Set up Relay" CTA is a navigation only — no token, key, or credential is exposed in the URL.
- Console error assertion in E2E catches accidental leakage of stack traces or token-shaped strings.

---

## 10. Sprint Decomposition

Five sprints, sequential except where noted. Each sprint produces a working state.

| # | Title | Batch | Depends on | Model |
|---|---|---|---|---|
| 1 | Fix schema mismatch + SystemStatus endpoint | 1 | — | sonnet |
| 2 | Empty-state branching: pure function + branch components | 2 | 1 | sonnet |
| 3 | New BFF routes for Core endpoints | 2 | 1 | sonnet |
| 4 | DashboardOverview rebuild (Branch C sections + wiring) | 3 | 2, 3 | sonnet |
| 5 | Playwright E2E + dev-server smoke | 4 | 4 | sonnet |

Sprints 2 and 3 may run in parallel (different file sets). All others are strictly sequential.

---

## 11. Verification (page-level acceptance criteria)

| # | Criterion | How verified |
|---|---|---|
| AC-1 | Total Analyses card displays the integer from Core's `total` | Vitest unit test on `mapIncidentAnalytics`; Playwright asserts `getByTestId('metric-total-analyses')` text matches stubbed value |
| AC-2 | "Analyses this month" card no longer renders | Vitest snapshot of `DashboardOverview`; Playwright `expect(getByTestId('metric-monthly-analyses')).toHaveCount(0)` |
| AC-3 | `SystemStatus` calls `/api/health`, not `/api/health/detailed` | Vitest mocks `fetch` and asserts URL; Playwright asserts network request observed |
| AC-4 | Branch A renders both CTAs with correct hrefs | Component test + Playwright stub-based E2E |
| AC-5 | Branch B renders single "Create Your First Analysis" CTA | Component test + Playwright |
| AC-6 | Branch C renders System operational card and all 7 new sections | Component test + Playwright |
| AC-7 | Each new BFF route returns 200 with stubbed `HttpApiClient` | Vitest integration test per handler |
| AC-8 | Dev server starts cleanly, Playwright run shows zero `console.error`, zero unhandled rejections, and zero 5xx from `/api/*` | Playwright `page.on('console')` + `page.on('pageerror')` assertions; route response listener |
| AC-9 | One section's failure does not break the page | Playwright stubs `/api/memory/insights` to 500 and asserts the rest of the page still renders, and only the memory section shows the error chip |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `/api/health` BFF route doesn't exist yet | Sprint 1 verifies and creates it as a thin re-export from existing `health-handler.ts`. File boundary recorded. |
| `/dashboard/relay` route doesn't exist | Sprint 4 verifies; if missing, CTA degrades to `/dashboard/integrations?type=relay`. INVARIANTS.md captures the binding. |
| Core endpoint shape drifts again silently | INVARIANTS.md registers the `IncidentAnalytics` contract with a verify command that greps the remap function and the type definition. |
| Section fetches all running on mount cause request waterfall | Each section uses its own `useEffect` + `AbortController`; they fire in parallel, not chained. |
| E2E flakes due to real Core dependency | All E2E tests stub `/api/*` routes via Playwright route interception. The Playwright run never touches a real Core. |
| `getUsageHistory` parameter (`days`) is mismapped to `limit` already (line 524 of http-api-client) | Documented; sprint 4 just consumes whatever the existing method returns and renders sparkline. No fix in scope. |

---

## 13. Out-of-Scope Discoveries (log only)

Anything found during implementation that is unrelated to the eight goals goes here, **not** into a sprint.

- **[Sprint 1]** `apps/dashboard/src/contexts/shared/presentation/pages/intelligence-page.tsx` imports `react-markdown` but the package is not in `apps/dashboard/package.json`. Causes `pnpm turbo build` and `tsc --noEmit` to fail. Likely introduced by the in-flight onboarding tutorial PRD. Fix: add `react-markdown` to dependencies OR remove the import if the page isn't shipping yet.
- **[Sprint 1]** `apps/dashboard/src/contexts/billing/application/__tests__/services.test.ts:166` uses `planId: 'free'` which is no longer a valid `TenantPlan`. Causes `tsc --noEmit` to fail (vitest still passes because the type is bypassed at runtime). Fix: update fixture to a current plan id or widen the test type.
- **[Sprint 1]** `http-api-client.ts` contains 40+ pre-existing `any` types (biome warnings, not errors). Not fixed in this sprint to keep scope tight; worth a follow-up refactor.
- **[Sprint 1]** `IncidentAnalytics` previously had a `resolvedIncidents: number` field that is NOT in the PRD §8 canonical shape and NOT in Core's wire shape. Sprint 1 removed it and updated the single consumer (`metrics-handler.ts`) to derive `resolvedAnalyses` from `byStatus.resolved` instead. This matches Core's semantics (the usecase counts `incident.status === 'resolved'` into `byStatus`).

---

## 14. Definition of Done

- All 9 acceptance criteria pass.
- Build Candidate tag exists.
- All sprint specs marked completed in `progress.json`.
- `pnpm exec biome check .` clean.
- `pnpm turbo check-types` clean.
- `pnpm vitest run` green.
- `pnpm exec playwright test apps/dashboard/tests/dashboard-overview.spec.ts` green.
- Dev server (`pnpm --filter dashboard dev`) starts and serves `/dashboard` with zero console errors when navigating through all three branches.
